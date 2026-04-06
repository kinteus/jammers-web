"use server";

import { UserRole } from "@prisma/client";

import { getCurrentUser } from "@/lib/auth/current-user";
import { env } from "@/lib/env";
import { hasActiveBan } from "@/lib/permissions";
import { normalizeTelegramUsername } from "@/lib/auth/telegram-username";

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  if (hasActiveBan(user)) {
    throw new Error("This account is currently banned.");
  }

  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();

  if (!user || user.role !== UserRole.ADMIN) {
    throw new Error("Admin access required.");
  }

  return user;
}

export function isSuperAdminUser(user: { telegramUsername: string | null } | null | undefined) {
  return (
    normalizeTelegramUsername(user?.telegramUsername) ===
    normalizeTelegramUsername(env.DEFAULT_ADMIN_USERNAME)
  );
}

export async function requireSuperAdmin() {
  const user = await requireAdmin();

  if (!isSuperAdminUser(user)) {
    throw new Error("Only the primary admin can manage the admin list.");
  }

  return user;
}
