import crypto from "node:crypto";

import { cookies, headers } from "next/headers";

import { db } from "@/lib/db";
import { env } from "@/lib/env";

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

  const session = await db.authSession.findUnique({
    where: {
      tokenHash: hashToken(rawToken),
    },
    include: {
      user: {
        include: {
          instruments: {
            include: {
              instrument: true,
            },
          },
          bans: {
            where: {
              OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
        },
      },
    },
  });

  if (!session || session.expiresAt <= new Date()) {
    cookieStore.delete(env.SESSION_COOKIE_NAME);
    return null;
  }

  await db.authSession.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  });

  return session.user;
}
