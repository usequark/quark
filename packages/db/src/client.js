import { PrismaClient } from "./generated/prisma/client.js";

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient({});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "./generated/prisma/client.js";
