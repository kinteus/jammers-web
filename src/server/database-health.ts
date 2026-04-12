import "server-only";

import { db } from "@/lib/db";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";

const DATABASE_HEALTH_TIMEOUT_MS = 1500;

export async function isDatabaseAvailable(timeoutMs = DATABASE_HEALTH_TIMEOUT_MS) {
  const result = await Promise.race([
    db.$queryRaw`SELECT 1`
      .then(() => ({ ok: true as const }))
      .catch((error: unknown) => {
        if (isDatabaseUnavailableError(error)) {
          return { ok: false as const, reason: "unavailable" as const };
        }

        return { ok: false as const, reason: "unexpected" as const, error };
      }),
    new Promise<{ ok: false; reason: "timeout" }>((resolve) => {
      setTimeout(() => resolve({ ok: false, reason: "timeout" }), timeoutMs);
    }),
  ]);

  if (result.ok) {
    return true;
  }

  if (result.reason === "unexpected") {
    throw result.error;
  }

  return false;
}
