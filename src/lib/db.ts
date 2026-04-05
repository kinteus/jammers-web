import { PrismaClient } from "@prisma/client";

type AppPrismaClient = PrismaClient & {
  sitePageContent: PrismaClient["sitePageContent"];
};

declare global {
  var prisma: AppPrismaClient | undefined;
}

export const db: AppPrismaClient =
  global.prisma ??
  (new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  }) as AppPrismaClient);

if (process.env.NODE_ENV !== "production") {
  global.prisma = db;
}
