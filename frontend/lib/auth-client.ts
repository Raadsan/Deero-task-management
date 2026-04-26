import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";
import { nextCookies } from "better-auth/next-js";
import { createAuthClient } from "better-auth/react";
import { auth } from "./auth";
import {
  accessControl,
  adminRole,
  superAdminRole,
  userRole,
} from "./permissions";

export const authClient = createAuthClient({
  basePath: "/api/auth",
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
  plugins: [
    inferAdditionalFields<typeof auth>(),
    nextCookies(),
    adminClient({
      ac: accessControl,
      roles: {
        user: userRole,
        admin: adminRole,
        superadmin: superAdminRole,
      },
      adminRoles: ["admin", "manager"],
    }),
  ],
});
