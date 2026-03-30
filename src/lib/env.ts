import { z } from "zod";

const rawSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://postgres:postgres@localhost:5432/jammers"),
  SESSION_SECRET: z.string().min(16).optional(),
  SESSION_COOKIE_NAME: z.string().default("jammers_session"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(168),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_AUTH_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(86400),
  ENABLE_DEV_AUTH: z.string().optional(),
  DEFAULT_ADMIN_USERNAME: z.string().default("kinteus"),
});

const rawEnv = rawSchema.parse(process.env);

if (rawEnv.NODE_ENV === "production" && !rawEnv.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set in production.");
}

export const env = {
  ...rawEnv,
  SESSION_SECRET: rawEnv.SESSION_SECRET ?? "local-development-session-secret",
  ENABLE_DEV_AUTH:
    rawEnv.ENABLE_DEV_AUTH !== undefined
      ? rawEnv.ENABLE_DEV_AUTH === "true"
      : rawEnv.NODE_ENV !== "production",
};
