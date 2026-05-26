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

  if (parsed?.type !== "board-updated" || typeof parsed.eventId !== "string") {
    return;
  }

  const clients = boardClients.get(parsed.eventId);
  if (!clients) {
    return;
  }

  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(payload);
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
  void handle(req, res);
});
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (socket, request) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const eventId = url.searchParams.get("eventId");
  if (!eventId) {
    socket.close(1008, "eventId is required");
    return;
  }

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

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (url.pathname !== "/ws/board") {
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
