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
    case "portfolios":
      return "DBR";
    case "departments":
      return "DDP";
    case "projects":
      return "DPR";
    case "content_requests":
      return "DCR";
    case "recurring_schedules":
      return "DRS";
    case "content_cycles":
      return "DCY";
    case "workflow_templates":
      return "DWF";
    case "contracts":
      return "DCT";
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

/** Sequential display id for clients: CL-0001, CL-0002, … */
export async function generateClientCode(prismaClient) {
  const client = prismaClient || prisma;
  const rows = await client.$queryRaw`
    SELECT MAX(CAST(SUBSTRING(clientCode, 4) AS UNSIGNED)) AS maxSeq
    FROM clients
    WHERE clientCode REGEXP '^CL-[0-9]+$'
  `;
  const maxSeq = Number(rows?.[0]?.maxSeq ?? 0);
  return `CL-${String(maxSeq + 1).padStart(4, "0")}`;
}

/** Sequential display id for main services: SRV-001, SRV-002, … */
export async function generateServiceCode(prismaClient) {
  const client = prismaClient || prisma;
  const rows = await client.$queryRaw`
    SELECT MAX(CAST(SUBSTRING(serviceCode, 5) AS UNSIGNED)) AS maxSeq
    FROM services
    WHERE serviceCode REGEXP '^SRV-[0-9]+$'
  `;
  const maxSeq = Number(rows?.[0]?.maxSeq ?? 0);
  return `SRV-${String(maxSeq + 1).padStart(3, "0")}`;
}

/** Sequential display id for projects: PRJ-0001, PRJ-0002, … */
export async function generateProjectCode(prismaClient) {
  const client = prismaClient || prisma;
  const rows = await client.$queryRaw`
    SELECT MAX(CAST(SUBSTRING(projectCode, 5) AS UNSIGNED)) AS maxSeq
    FROM projects
    WHERE projectCode REGEXP '^PRJ-[0-9]+$'
  `;
  const maxSeq = Number(rows?.[0]?.maxSeq ?? 0);
  return `PRJ-${String(maxSeq + 1).padStart(4, "0")}`;
}
