import { PrismaClient } from "../../lib/generated/prisma/index.js";
import dotenv from "dotenv";

dotenv.config();

// Singleton in dev; nodemon restarts when lib/generated/prisma/index.js changes.

const globalForPrisma = globalThis;

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

async function disconnectPrisma() {
  try {
    await prisma.$disconnect();
  } catch {
    // ignore shutdown errors
  }
}

process.once("SIGINT", () => {
  void disconnectPrisma().finally(() => process.exit(0));
});

process.once("SIGTERM", () => {
  void disconnectPrisma().finally(() => process.exit(0));
});

process.once("beforeExit", () => {
  void disconnectPrisma();
});
