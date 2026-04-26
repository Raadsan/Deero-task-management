import { prisma } from "./prisma.js";

export function getPrefix(data) {
  switch (data) {
    case "clients":
      return "DCL";
    case "users":
      return "DUS";
    case "tasks":
      return "DTA";
    case "services":
      return "DSE";
    case "subservices":
      return "DSS";
    case "payments":
      return "DPA";
    case "invoice":
      return "DINV-";
    case "tax":
      return "DTX";
  }
}

export async function generateCustomId({ entityTybe, prisma: tx }) {
  const prismaClient = tx || prisma;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const prefix = getPrefix(entityTybe);

  const result = await prismaClient.counter.upsert({
    where: {
      entity_year_month: {
        entity: entityTybe,
        year,
        month,
      },
    },
    update: {
      sequence: {
        increment: 1,
      },
    },
    create: {
      entity: entityTybe,
      year,
      month,
      sequence: 1,
    },
  });

  const formatSequence = String(result.sequence).padStart(5, "0");
  return `${prefix}${year}${month}${formatSequence}`;
}
