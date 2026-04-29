#!/usr/bin/env node

import { createServer, Socket } from "node:net";
import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { PrismaClient } from "@prisma/client";

const DEFAULT_KUBECONFIG = "~/.kube/config-jammers-microk8s";
const DEFAULT_NAMESPACE = "prod";
const DEFAULT_SERVICE = "svc/jammers-web-postgres";
const DEFAULT_DB_PORT = 55432;
const DEFAULT_APP_PORT = 3001;
const DEFAULT_APP_HOST = "127.0.0.1";
const DEFAULT_DB_READY_TIMEOUT_MS = 30_000;

function parseEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        const key = line.slice(0, separatorIndex).trim();
        const rawValue = line.slice(separatorIndex + 1).trim();
        const value = rawValue.replace(/^(['"])(.*)\1$/, "$2");
        return [key, value];
      }),
  );
}

function isLocalDevelopmentDatabaseUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase();
    const databaseName = url.pathname.replace(/^\//, "");
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

    return (
      (url.username === "postgres" && databaseName === "jammers") ||
      (isLocalHost && (url.port === "5432" || databaseName === "jammers"))
    );
  } catch {
    return false;
  }
}

function getProdDatabaseUrl({
  env = process.env,
  envLocalPath = ".env.local",
  envPath = ".env",
} = {}) {
  const envLocal = parseEnvFile(envLocalPath);
  const envFile = parseEnvFile(envPath);
  const candidates = [
    { value: env.JAMMERS_PROD_DATABASE_URL, explicit: true },
    { value: envLocal.JAMMERS_PROD_DATABASE_URL, explicit: true },
    { value: envFile.JAMMERS_PROD_DATABASE_URL, explicit: true },
    { value: envLocal.DATABASE_URL, explicit: false },
    { value: env.DATABASE_URL, explicit: false },
    { value: envFile.DATABASE_URL, explicit: false },
  ];

  const candidate = candidates.find(
    ({ value, explicit }) => value && (explicit || !isLocalDevelopmentDatabaseUrl(value)),
  );

  return candidate?.value;
}

function buildTunnelDatabaseUrl(rawUrl, localPort) {
  if (!rawUrl) {
    throw new Error(
      "No production DATABASE_URL found. Set JAMMERS_PROD_DATABASE_URL or keep DATABASE_URL in .env.local.",
    );
  }

  const url = new URL(rawUrl);
  url.hostname = "127.0.0.1";
  url.port = String(localPort);
  return url.toString();
}

function expandHomePath(path) {
  if (path === "~") {
    return homedir();
  }
  if (path.startsWith("~/")) {
    return `${homedir()}${path.slice(1)}`;
  }
  return path;
}

function isPortFree(port, host = DEFAULT_APP_HOST) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function findFreePort(startPort, host = DEFAULT_APP_HOST) {
  for (let port = startPort; port < startPort + 50; port += 1) {
    if (await isPortFree(port, host)) {
      return port;
    }
  }

  throw new Error(`No free port found starting at ${startPort}.`);
}

function waitForPort(port, host = DEFAULT_APP_HOST, timeoutMs = 15_000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    function attempt() {
      const socket = new Socket();
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}.`));
          return;
        }
        setTimeout(attempt, 250);
      });
      socket.connect(port, host);
    }

    attempt();
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForDatabase(databaseUrl, timeoutMs = DEFAULT_DB_READY_TIMEOUT_MS) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt <= timeoutMs) {
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });

    try {
      await prisma.$queryRawUnsafe("select 1");
      await prisma.$disconnect();
      return;
    } catch (error) {
      lastError = error;
      await prisma.$disconnect().catch(() => {});
      await sleep(500);
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Timed out waiting for the production DB tunnel to accept SQL connections. ${detail}`);
}

function spawnInherited(command, args, options = {}) {
  return spawn(command, args, {
    stdio: "inherit",
    ...options,
  });
}

async function main() {
  const kubeconfig = expandHomePath(process.env.JAMMERS_KUBECONFIG || DEFAULT_KUBECONFIG);
  const namespace = process.env.JAMMERS_K8S_NAMESPACE || DEFAULT_NAMESPACE;
  const service = process.env.JAMMERS_POSTGRES_SERVICE || DEFAULT_SERVICE;
  const appHost = process.env.JAMMERS_LOCAL_HOST || DEFAULT_APP_HOST;
  const requestedAppPort = Number(process.env.JAMMERS_LOCAL_PORT || DEFAULT_APP_PORT);
  const appPort = process.env.JAMMERS_LOCAL_PORT
    ? requestedAppPort
    : await findFreePort(requestedAppPort, appHost);
  const dbPort = await findFreePort(Number(process.env.JAMMERS_DB_TUNNEL_PORT || DEFAULT_DB_PORT));
  const databaseUrl = buildTunnelDatabaseUrl(getProdDatabaseUrl(), dbPort);

  console.log(`Starting production DB tunnel on ${DEFAULT_APP_HOST}:${dbPort}...`);
  const tunnel = spawnInherited("kubectl", [
    "--kubeconfig",
    kubeconfig,
    "-n",
    namespace,
    "port-forward",
    service,
    `${dbPort}:5432`,
  ]);

  let app = null;
  let stopping = false;
  const stop = () => {
    stopping = true;
    if (!tunnel.killed) {
      tunnel.kill("SIGTERM");
    }
  };

  process.once("SIGINT", () => {
    stop();
    process.exit(130);
  });
  process.once("SIGTERM", () => {
    stop();
    process.exit(143);
  });

  tunnel.once("exit", (code, signal) => {
    if (stopping) {
      return;
    }

    console.error(
      `Production DB tunnel exited unexpectedly${signal ? ` with signal ${signal}` : ` with code ${code ?? 0}`}.`,
    );
    if (app && !app.killed) {
      app.kill("SIGTERM");
    }
    process.exit(code ?? 1);
  });

  try {
    await waitForPort(dbPort);
    console.log("Production DB tunnel is listening. Verifying SQL connection...");
    await waitForDatabase(databaseUrl);
  } catch (error) {
    stop();
    throw error;
  }

  console.log(`Production DB tunnel is ready. Starting local app on http://${appHost}:${appPort}`);
  app = spawnInherited(
    "npm",
    ["run", "dev", "--", "--hostname", appHost, "--port", String(appPort)],
    {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        ENABLE_DEV_AUTH: process.env.ENABLE_DEV_AUTH ?? "true",
        LIVE_PRODUCTION_TUNNEL: "true",
        NEXT_PUBLIC_APP_URL: `http://${appHost}:${appPort}`,
      },
    },
  );

  app.once("exit", (code, signal) => {
    stop();
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

export { buildTunnelDatabaseUrl, getProdDatabaseUrl, parseEnvFile };
