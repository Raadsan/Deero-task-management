import { PrismaClient } from "../../lib/generated/prisma/index.js";
import dotenv from "dotenv";

dotenv.config();

// Singleton in dev; nodemon restarts when lib/generated/prisma/index.js changes.

const globalForPrisma = globalThis;

function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  const separator = url && url.includes("?") ? "&" : "?";
  const pooledUrl =
    url && !url.includes("connection_limit")
      ? `${url}${separator}connection_limit=5&pool_timeout=30&connect_timeout=30`
      : url;

  return new PrismaClient({
    datasources: pooledUrl
      ? {
          db: {
            url: pooledUrl,
          },
        }
      : undefined,
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
