// Prisma removed from frontend
// import { prisma } from "@/prisma/prisma";
import { betterAuth } from "better-auth";
// import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";
import { generateCustomId } from "@/lib/apis/sharedApi";
import {
  accessControl,
  adminRole,
  superAdminRole,
  userRole,
} from "./permissions";

const authBaseUrl =
  process.env.BETTER_AUTH_URL ||
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:7003";

export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: authBaseUrl,
  secret:
    process.env.BETTER_AUTH_SECRET ||
    process.env.AUTH_SECRET ||
    "set-BETTER_AUTH_SECRET-in-env",
  // Database removed from frontend — real auth runs on the Express backend (Prisma).
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
    defaultCookieAttributes: {
      sameSite: "lax",
      maxAge: 8 * 60 * 60, // 8 hours
    },
  },
  session: {
    expiresIn: 8 * 60 * 60, // 8 hours
    updateAge: 60 * 60, // refresh every 1 hr when active
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
      gender: {
        type: "string",
        input: true,
      },
      salary: {
        type: "string",
        input: true,
      },
      department: {
        type: "string",
        input: true,
      },
      portfolioId: {
        type: "string",
        input: true,
        required: false,
      },
      roleId: {
        type: "string",
        input: true,
        required: false,
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
