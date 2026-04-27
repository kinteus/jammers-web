import { appendFile, mkdir, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_ERROR_LOG_DIR = "/tmp/jammers-error-logs";
const DEFAULT_RETENTION_DAYS = 14;
const MAX_FIELD_LENGTH = 8_000;

export type AppErrorLogEntry = {
  errorId: string;
  source: "client-error-boundary" | "server";
  createdAt?: string;
  digest?: string | null;
  message?: string | null;
  name?: string | null;
  path?: string | null;
  stack?: string | null;
  userAgent?: string | null;
};

function getErrorLogDir() {
  return process.env.ERROR_LOG_DIR || DEFAULT_ERROR_LOG_DIR;
}

function getRetentionDays() {
  const value = Number(process.env.ERROR_LOG_RETENTION_DAYS);
  return Number.isFinite(value) && value > 0
    ? Math.round(value)
    : DEFAULT_RETENTION_DAYS;
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseLogDate(filename: string) {
  const match = filename.match(/^errors-(\d{4}-\d{2}-\d{2})\.log$/);
  if (!match) {
    return null;
  }

  const date = new Date(`${match[1]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function trimField(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value.slice(0, MAX_FIELD_LENGTH);
}

function normalizeEntry(entry: AppErrorLogEntry, now: Date) {
  return {
    type: "app_error",
    errorId: trimField(entry.errorId) ?? "err_unknown",
    source: entry.source,
    createdAt: entry.createdAt ?? now.toISOString(),
    digest: trimField(entry.digest),
    name: trimField(entry.name),
    message: trimField(entry.message),
    path: trimField(entry.path),
    stack: trimField(entry.stack),
    userAgent: trimField(entry.userAgent),
  };
}

async function pruneOldLogFiles(logDir: string, now: Date) {
  const retentionMs = getRetentionDays() * 24 * 60 * 60 * 1000;
  const cutoff = now.getTime() - retentionMs;
  const files = await readdir(logDir);

  await Promise.all(
    files.map(async (filename) => {
      const logDate = parseLogDate(filename);
      if (!logDate || logDate.getTime() >= cutoff) {
        return;
      }

      await unlink(join(logDir, filename));
    }),
  );
}

export async function recordAppError(entry: AppErrorLogEntry) {
  const now = new Date();
  const logDir = getErrorLogDir();
  const normalizedEntry = normalizeEntry(entry, now);
  const line = `${JSON.stringify(normalizedEntry)}\n`;

  console.error(line.trimEnd());

  await mkdir(logDir, { recursive: true });
  await pruneOldLogFiles(logDir, now);
  await appendFile(join(logDir, `errors-${formatDateKey(now)}.log`), line, "utf8");
}
