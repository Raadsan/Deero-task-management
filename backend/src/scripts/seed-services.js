import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import { generateCustomId } from "../lib/id-generator.js";
import { DEFAULT_SERVICES } from "../data/default-services.js";

async function ensureServiceWithSubs(branchId, { serviceName, subServices }) {
  let service = await prisma.service.findFirst({
    where: { serviceName, branchId },
    include: { subService: true },
  });

  if (!service) {
    const id = await generateCustomId({ entityTybe: "services" });
    service = await prisma.service.create({
      data: {
        id,
        serviceName,
        branchId,
      },
      include: { subService: true },
    });
    console.log(`  + Service: ${serviceName}`);
  } else {
    console.log(`  = Service exists: ${serviceName}`);
  }

  const existingNames = new Set(service.subService.map((sub) => sub.name));

  for (const name of subServices) {
    if (existingNames.has(name)) {
      console.log(`    = Sub-service exists: ${name}`);
      continue;
    }

    const subId = await generateCustomId({ entityTybe: "subservices" });
    await prisma.subService.create({
      data: {
        id: subId,
        name,
        categoryId: service.id,
      },
    });
    console.log(`    + Sub-service: ${name}`);
  }
}

async function main() {
  console.log("Seeding default services and sub-services...\n");

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: [{ isMain: "desc" }, { name: "asc" }],
  });

  if (branches.length === 0) {
    console.log("No active branches found. Create a branch first, then run this script again.");
    return;
  }

  for (const branch of branches) {
    console.log(`Branch: ${branch.name} (${branch.id})`);
    for (const catalog of DEFAULT_SERVICES) {
      await ensureServiceWithSubs(branch.id, catalog);
    }
    console.log("");
  }

  const [serviceCount, subServiceCount] = await Promise.all([
    prisma.service.count(),
    prisma.subService.count(),
  ]);

  console.log(`Done. Total services: ${serviceCount}, sub-services: ${subServiceCount}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
