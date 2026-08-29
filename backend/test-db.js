import { prisma } from "./src/lib/prisma.js";

async function main() {
  const [tasks, staff, roleAccess] = await Promise.all([
    prisma.task.count(),
    prisma.staff.count(),
    prisma.roleMenuAccess.count(),
  ]);
  console.log("DB CONNECTION SUCCESSFUL!");
  console.log("Tasks:", tasks, "Staff:", staff, "RoleMenuAccess:", roleAccess);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("DB Error:", e);
  process.exit(1);
});
