import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins/admin";
import { prisma } from "./prisma.js";
import { generateCustomId } from "./id-generator.js";
import {
  accessControl,
  adminRole,
  superAdminRole,
  userRole,
} from "./permissions.js";

export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, {
    provider: "mysql",
  }),
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:5000",
    process.env.FRONTEND_URL
  ].filter(Boolean),
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    database: {
      generateId: false,
    },
  },

  emailAndPassword: {
    enabled: true,
  },

  databaseHooks: {
    user: {
      create: {
        async before(user) {
          const id = await generateCustomId({ entityTybe: "users" });
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
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    cookie: {
      sameSite: "lax",
    }
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
