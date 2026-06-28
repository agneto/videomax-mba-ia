import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 *
 * In development, Next.js HMR re-evaluates modules on every change, which would
 * otherwise create a new PrismaClient (and a new connection pool) each time.
 * Caching the instance on `globalThis` keeps a single client across reloads.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
