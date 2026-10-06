import { createServer } from "node:http";
import next from "next";
import { Client } from "pg";
import { WebSocketServer } from "ws";

const BOARD_EVENTS_CHANNEL = "jammers_board_events";

function getArgValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  return process.argv[index + 1] ?? fallback;
}

const dev = process.argv.includes("--dev") || process.env.NODE_ENV !== "production";
const hostname = getArgValue("--hostname", process.env.HOSTNAME || "0.0.0.0");
const port = Number(getArgValue("--port", process.env.PORT || "3000"));

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const boardClients = new Map();

function broadcastBoardUpdate(payload) {
  let parsed;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return;
  }

  if (parsed?.type !== "board-updated" || typeof parsed.eventId !== "string" ||
      !["event-status", "event-updated", "selection-run", "seat-claimed", "seat-released", "track-created", "track-updated"].includes(parsed.reason)) {
    return;
  }

  const clients = boardClients.get(parsed.eventId);
  if (!clients) {
    return;
  }

  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({ type: "board-updated", eventId: parsed.eventId, reason: parsed.reason }));
    }
  }
}

async function startPostgresListener() {
  if (!process.env.DATABASE_URL) {
    return;
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();
  await client.query(`LISTEN ${BOARD_EVENTS_CHANNEL}`);
  client.on("notification", (message) => {
    if (message.channel === BOARD_EVENTS_CHANNEL && message.payload) {
      broadcastBoardUpdate(message.payload);
    }
  });

  const close = async () => {
    await client.end().catch(() => {});
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

await app.prepare();

const server = createServer((req, res) => {
  // Strip framework-internal and nonce headers at the public HTTP boundary.
  for (const name of ["x-middleware-subrequest", "x-middleware-subrequest-id", "content-security-policy", "x-nonce"]) delete req.headers[name];
  void handle(req, res);
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 1024, perMessageDeflate: false });

wss.on("connection", (socket, request) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const eventId = url.searchParams.get("eventId");
  if (!eventId) {
    socket.close(1008, "eventId is required");
    return;
  }

  socket.on("error", () => socket.terminate());
  // This is a receive-only invalidation channel, never an application command endpoint.
  socket.on("message", () => socket.close(1008, "Client messages are not supported"));
  socket.isAlive = true;
  socket.on("pong", () => { socket.isAlive = true; });
  const clients = boardClients.get(eventId) ?? new Set();
  clients.add(socket);
  boardClients.set(eventId, clients);
  socket.on("close", () => {
    clients.delete(socket);
    if (clients.size === 0) {
      boardClients.delete(eventId);
    }
  });
});

const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    if (!socket.isAlive) { socket.terminate(); continue; }
    socket.isAlive = false;
    socket.ping();
  }
}, 30_000);
heartbeat.unref();
wss.on("close", () => clearInterval(heartbeat));

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  let expectedOrigin;
  try { expectedOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL || `http://${request.headers.host}`).origin; }
  catch { socket.destroy(); return; }
  if (url.pathname !== "/ws/board" || request.headers.origin !== expectedOrigin ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(url.searchParams.get("eventId") ?? "") || wss.clients.size >= 1000) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (client) => {
    wss.emit("connection", client, request);
  });
});

await startPostgresListener();

server.listen(port, hostname, () => {
  console.log(`> Ready on http://${hostname}:${port}`);
});
