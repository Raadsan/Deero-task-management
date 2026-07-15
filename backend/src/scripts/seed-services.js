import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import { generateCustomId } from "../lib/id-generator.js";
import { DEFAULT_SERVICES } from "../data/default-services.js";

async function ensureServiceWithSubs(portfolioId, { serviceName, subServices }) {
  let service = await prisma.service.findFirst({
    where: { serviceName, portfolioId },
    include: { subService: true },
  });

  if (!service) {
    const id = await generateCustomId({ entityTybe: "services" });
    service = await prisma.service.create({
      data: {
        id,
        serviceName,
        portfolioId,
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

  const portfolios = await prisma.portfolio.findMany({
    where: { isActive: true },
    orderBy: [{ usesRootLogin: "desc" }, { name: "asc" }],
  });

  if (portfolios.length === 0) {
    console.log("No active portfolios found. Create a portfolio first, then run this script again.");
    return;
  }

  for (const portfolio of portfolios) {
    console.log(`Portfolio: ${portfolio.name} (${portfolio.id})`);
    for (const catalog of DEFAULT_SERVICES) {
      await ensureServiceWithSubs(portfolio.id, catalog);
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
