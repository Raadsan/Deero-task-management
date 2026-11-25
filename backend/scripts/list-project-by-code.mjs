import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

const code = process.argv[2] || "PRJ-0004";
const rows = await prisma.project.findMany({
  where: { OR: [{ projectCode: code }, { name: { contains: "Netlink" } }] },
  select: { id: true, projectCode: true, name: true, contractId: true, _count: { select: { tasks: true } } },
});
console.log(rows);
await prisma.$disconnect();