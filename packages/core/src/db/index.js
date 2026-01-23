import { PrismaClient } from "@prisma/client";

/**
 * Creates a singleton Prisma client.
 * In development, it attaches to globalThis to prevent multiple instances.
 */
export const createDbClient = (options = {}) => {
  const globalForPrisma = globalThis;
  const prisma = globalForPrisma.prisma || new PrismaClient(options);

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
  }

  return prisma;
};
