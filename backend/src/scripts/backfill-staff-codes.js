import { prisma } from "../lib/prisma.js";

const staff = await prisma.staff.findMany({
  include: { portfolio: { select: { name: true } } },
  orderBy: { createdAt: "asc" },
});

const resequence = process.argv.includes("--resequence");
const counters = new Map();
if (!resequence) {
  for (const user of staff) {
    if (!user.staffCode) continue;
    const prefix = String(user.staffCode).startsWith("RT") ? "RT" : "DAA";
    const sequence = Number(String(user.staffCode).split("#").pop());
    counters.set(
      prefix,
      Math.max(counters.get(prefix) ?? 0, Number.isFinite(sequence) ? sequence : 0),
    );
  }
}
let updated = 0;
for (const user of staff) {
  if (user.staffCode && !resequence) continue;
  const prefix = /raadsan/i.test(String(user.portfolio?.name ?? ""))
    ? "RT"
    : "DAA";
  const year = String(new Date(user.createdAt).getFullYear()).slice(-2);
  const stem = `${prefix}${year}#`;
  const sequence = (counters.get(stem) ?? 0) + 1;
  counters.set(stem, sequence);
  const staffCode = `${stem}${String(sequence).padStart(2, "0")}`;
  await prisma.staff.update({ where: { id: user.id }, data: { staffCode } });
  updated += 1;
}

console.log(JSON.stringify({ staff: staff.length, updated }));
await prisma.$disconnect();
