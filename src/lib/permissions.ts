import { UserRole, type User } from "@prisma/client";

export function isAdmin(user: Pick<User, "role"> | null | undefined) {
  return user?.role === UserRole.ADMIN;
}

export function hasActiveBan(
  user:
    | (Pick<User, "status"> & {
        bans?: Array<{
          endsAt: Date | null;
          isPermanent: boolean;
        }>;
      })
    | null
    | undefined,
) {
  if (!user) {
    return false;
  }

  return Boolean(
    user.bans?.some(
      (ban) => ban.isPermanent || ban.endsAt === null || ban.endsAt > new Date(),
    ),
  );
}
