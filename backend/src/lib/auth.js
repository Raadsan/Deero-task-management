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
import { createNotificationForAdmins } from "./notifications.js";

export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, {
    provider: "mysql",
  }),
  trustedOrigins: [
    "https://task.deero.so",
    "http://localhost:3000",
    "http://localhost:5000",
    "http://localhost:2003",
    process.env.FRONTEND_URL
  ].filter(Boolean),
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production" || process.env.BETTER_AUTH_URL?.startsWith("https"),
    database: {
      generateId: false,
    },
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
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
    session: {
      create: {
        async after(session) {
          try {
            const user = await prisma.staff.findUnique({
              where: { id: session.userId },
              select: { id: true, name: true, email: true, role: true, portfolioId: true },
            });

            if (!user) return;

            await createNotificationForAdmins({
              taskId: user.id,
              taskName: user.name || user.email,
              assigneeName: user.email || user.role,
              deadline: new Date(),
              type: "user-login",
              excludeUserId: user.id,
              portfolioId: user.portfolioId,
            });
          } catch (err) {
            console.error("Failed to create login notification:", err);
          }
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
    modelName: "staff",
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
