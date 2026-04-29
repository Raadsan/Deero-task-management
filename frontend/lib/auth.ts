// Prisma removed from frontend
// import { prisma } from "@/prisma/prisma";
import { betterAuth } from "better-auth";
// import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";
import { generateCustomId } from "./actions/shared.action";
import {
  accessControl,
  adminRole,
  superAdminRole,
  userRole,
} from "./permissions";

export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: process.env.BETTER_AUTH_URL,
  // Database removed from frontend - auth is handled by backend
  // database: prismaAdapter(prisma, {
  //   provider: "postgresql",
  // }),

  emailAndPassword: {
    enabled: true,
  },

  // Database hooks removed from frontend
  /*
  databaseHooks: {
    user: {
      create: {
        async before(user) {
          // modify user before it  is created for adding our custom id
          const { data: id } = await generateCustomId({ entityTybe: "users" });
          return {
            data: {
              ...user,
              id: id,
            },
          };
        },
      },
    },
  },
  */
  advanced: {
    database: {
      generateId: false,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
  },

  user: {
    additionalFields: {
      banned: {
        type: "boolean",
        input: false,
      },
      role: {
        type: ["admin", "user", "superadmin"],
        input: true,
      },
      banReason: {
        type: "string",
        input: false,
      },
      banExpires: {
        type: "date",
        input: false,
      },
    },
  },
  plugins: [
    nextCookies(),
    admin({
      ac: accessControl,
      roles: {
        user: userRole,
        admin: adminRole,
        superadmin: superAdminRole,
      },
      adminRoles: ["admin", "superadmin"],
      defaultRole: "superadmin",
      bannedUserMessage:
        "You have been banned to login! please contact Deero Admin Team for support.!!",
    }),
  ],
});

export type ErrorCodes = keyof typeof auth.$ERROR_CODES | "unknown";
