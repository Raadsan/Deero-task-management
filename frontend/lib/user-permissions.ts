import { authClient } from "./auth-client";

export async function canChangeUserPassword(role?: string | null) {
  if (!role) return false;
  if (role === "admin" || role === "superadmin") return true;

  try {
    const [setPasswordRes, updateRes] = await Promise.all([
      authClient.admin.hasPermission({
        permissions: { user: ["set-password"] },
      }),
      authClient.admin.hasPermission({
        permissions: { user: ["update"] },
      }),
    ]);

    return Boolean(setPasswordRes.data || updateRes.data);
  } catch {
    return false;
  }
}
