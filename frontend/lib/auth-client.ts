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

function resolveAuthClientBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return (
    process.env.NEXT_PUBLIC_APP_ORIGIN ||
    process.env.FRONTEND_URL ||
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:2003"
  ).replace(/[\'\"]/g, "");
}

export const authClient = createAuthClient({
  basePath: "/api/auth",
  baseURL: resolveAuthClientBaseUrl(),
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
      adminRoles: ["admin", "superadmin"],
    }),
  ],
});
