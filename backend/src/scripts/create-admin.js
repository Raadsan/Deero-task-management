import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import { auth } from "../lib/auth.js";

async function main() {
  const email = "admin@gmail.com";
  const password = "123456";
  const name = "Admin";

  console.log(`Checking if user ${email} exists...`);

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    console.log("User already exists. Updating password and role...");
    // signUpEmail won't work if user exists. 
    // For better-auth, updating password manually is tricky because of hashing.
    // However, if we use the auth instance, we might be able to use internal methods.
  }

  console.log("Attempting to create user via better-auth API...");

  try {
    const res = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
      },
    });

    if (res) {
      console.log("User created. Setting role to superadmin...");
      await prisma.user.update({
        where: { email },
        data: { role: "superadmin" },
      });
      console.log("Admin user created successfully!");
    }
  } catch (error) {
    console.error("Failed to create user:", error);
    console.log("Trying manual creation with prisma (Note: this might not work if password hashing is required)...");
    // If auth.api.signUpEmail fails in this context, we might need a different approach.
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
