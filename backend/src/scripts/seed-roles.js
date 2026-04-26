import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import { auth } from "../lib/auth.js";

async function main() {
  console.log("Starting seeding roles...");

  // 1. Create Roles
  const rolesToCreate = ["superadmin", "admin", "user", "registrar", "manager"];
  const createdRoles = {};

  for (const roleName of rolesToCreate) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
    createdRoles[roleName] = role;
    console.log(`Role '${roleName}' ensured.`);
  }

  // 2. Create Admin User linked to Superadmin Role
  const email = "admin@gmail.com";
  const password = "password123"; 
  const superadminRole = createdRoles["superadmin"];

  console.log(`Checking for admin user: ${email}...`);

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (!existingUser) {
    console.log("Creating admin user via Better Auth...");
    const res = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: "Super Admin",
      },
    });

    if (res) {
      console.log("Linking user to dynamic Superadmin role...");
      await prisma.user.update({
        where: { id: res.user.id },
        data: {
          dynamicRole: { connect: { id: superadminRole.id } },
          role: "superadmin"
        },
      });
      console.log("Admin user created and linked successfully!");
    }
  } else {
    console.log("Admin user already exists. Updating role link...");
    await prisma.user.update({
      where: { email },
      data: {
        dynamicRole: { connect: { id: superadminRole.id } },
        role: "superadmin"
      },
    });
  }

  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
