import "server-only";

import { db } from "@/lib/db";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";

export async function isDatabaseAvailable() {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return false;
    }

    throw error;
  }
}
