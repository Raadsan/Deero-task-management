import { PrismaClient } from "../lib/generated/prisma/index.js";
import dotenv from "dotenv";

// Load environment variables from .env
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database with initial roles and users...");

  // 1. Create Roles
  const adminRole = await prisma.role.upsert({
    where: { name: "admin" },
    update: {},
    create: {
      name: "admin",
    },
  });

  const userRole = await prisma.role.upsert({
    where: { name: "user" },
    update: {},
    create: {
      name: "user",
    },
  });

  console.log("✅ Roles created or already exist:", adminRole.name, ", ", userRole.name);

  // 2. Create an initial Admin User
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      id: "super-admin-id", // Manually set since it's not a UUID by default in your schema
      name: "Super Admin",
      email: "admin@example.com",
      emailVerified: true,
      roleId: adminRole.id,
      role: "admin",
      department: "Management"
    },
  });

  console.log("✅ Admin user created or already exists:", adminUser.email);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
