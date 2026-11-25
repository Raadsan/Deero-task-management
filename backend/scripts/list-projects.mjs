import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

const rows = await prisma.project.findMany({
  where: { archived: false },
  select: { id: true, projectCode: true, name: true, _count: { select: { tasks: true } } },
  orderBy: { projectCode: "asc" },
});
console.table(rows.map((r) => ({ code: r.projectCode, id: r.id, name: r.name, tasks: r._count.tasks })));
await prisma.$disconnect();