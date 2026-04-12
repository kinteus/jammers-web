import { z } from "zod";

import { isLocalProductionTunnelDatabaseUrl } from "@/lib/database-safety";

const rawSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).optional(),
  SESSION_SECRET: z.string().min(16).optional(),
  SESSION_COOKIE_NAME: z.string().default("jammers_session"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(168),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_FEEDBACK_CHAT_ID: z.string().optional(),
  TELEGRAM_AUTH_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(600),
  ENABLE_DEV_AUTH: z.string().optional(),
  PRIMARY_ADMIN_TELEGRAM_ID: z.string().optional(),
  DEFAULT_ADMIN_USERNAME: z.string().default("kinteus"),
});

const rawEnv = rawSchema.parse(process.env);
const databaseUrl =
  rawEnv.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/jammers";
const liveProductionTunnel = isLocalProductionTunnelDatabaseUrl(databaseUrl);

if (rawEnv.NODE_ENV === "production") {
  if (!rawEnv.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set in production.");
  }

  if (!rawEnv.SESSION_SECRET) {
    throw new Error("SESSION_SECRET must be set in production.");
  }
}

export const env = {
  ...rawEnv,
  DATABASE_URL: databaseUrl,
  LIVE_PRODUCTION_TUNNEL: liveProductionTunnel,
  SESSION_SECRET: rawEnv.SESSION_SECRET ?? "local-development-session-secret",
  ENABLE_DEV_AUTH:
    !liveProductionTunnel &&
    (rawEnv.ENABLE_DEV_AUTH !== undefined
      ? rawEnv.ENABLE_DEV_AUTH === "true"
      : rawEnv.NODE_ENV !== "production"),
};
