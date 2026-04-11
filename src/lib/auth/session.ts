import crypto from "node:crypto";

import { cookies, headers } from "next/headers";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";

const SESSION_LAST_SEEN_UPDATE_INTERVAL_MS = 15 * 60 * 1000;

function getSessionSecret() {
  if (
    env.NODE_ENV === "production" &&
    env.SESSION_SECRET === "__MISSING_PRODUCTION_SESSION_SECRET__"
  ) {
    throw new Error("SESSION_SECRET must be explicitly configured in production.");
  }

  return env.SESSION_SECRET;
}

function hashToken(token: string) {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(token)
    .digest("hex");
}

export async function createSession(userId: string) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000,
  );
  const headerStore = await headers();
  const cookieStore = await cookies();

  await db.authSession.deleteMany({
    where: { userId },
  });

  await db.authSession.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
      userAgent: headerStore.get("user-agent"),
      ipAddress:
        headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        headerStore.get("x-real-ip"),
    },
  });

  cookieStore.set(env.SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(env.SESSION_COOKIE_NAME)?.value;

  if (rawToken) {
    await db.authSession.deleteMany({
      where: {
        tokenHash: hashToken(rawToken),
      },
    });
  }

  cookieStore.delete(env.SESSION_COOKIE_NAME);
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(env.SESSION_COOKIE_NAME)?.value;

  if (!rawToken) {
    return null;
  }

  try {
    const session = await db.authSession.findUnique({
      where: {
        tokenHash: hashToken(rawToken),
      },
      select: {
        id: true,
        expiresAt: true,
        lastSeenAt: true,
        user: {
          select: {
            id: true,
            role: true,
            status: true,
            telegramId: true,
            telegramUsername: true,
            fullName: true,
            email: true,
            phone: true,
            bans: {
              where: {
                OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
              },
              select: {
                endsAt: true,
                isPermanent: true,
              },
            },
          },
        },
      },
    });

    if (!session || session.expiresAt <= new Date()) {
      if (session) {
        await db.authSession.delete({
          where: { id: session.id },
        });
      }
      return null;
    }

    const now = new Date();
    const shouldRefreshLastSeen =
      now.getTime() - session.lastSeenAt.getTime() >= SESSION_LAST_SEEN_UPDATE_INTERVAL_MS;

    if (shouldRefreshLastSeen) {
      await db.authSession.updateMany({
        where: {
          id: session.id,
          lastSeenAt: { lt: new Date(now.getTime() - SESSION_LAST_SEEN_UPDATE_INTERVAL_MS) },
        },
        data: { lastSeenAt: now },
      });
    }

    return session.user;
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return null;
    }

    throw error;
  }
}
