import { ROUTES } from "@/lib/constants";

export async function signOutAndRedirect() {
  const authUrl =
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:7003";
  const response = await fetch(`${authUrl}/api/auth/sign-out`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });

  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.message || "Logout failed");
  }

  window.location.replace(ROUTES.login);
}