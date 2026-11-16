import { PrismaClient } from "../../lib/generated/prisma/index.js";
import dotenv from "dotenv";

dotenv.config();

/** Bump when `npx prisma generate` changes the client schema (forces a fresh client in dev). */
const PRISMA_SCHEMA_REV = "2026-11-contract-payment-terms";

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

if (
  globalForPrisma.prisma &&
  globalForPrisma.prismaSchemaRev !== PRISMA_SCHEMA_REV
) {
  void globalForPrisma.prisma.$disconnect().catch(() => {});
  globalForPrisma.prisma = undefined;
}

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = createPrismaClient();
  globalForPrisma.prismaSchemaRev = PRISMA_SCHEMA_REV;
}

export const prisma = globalForPrisma.prisma;

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
