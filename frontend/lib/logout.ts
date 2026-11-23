import { API_URL } from "@/lib/apis/config";
import { ROUTES } from "@/lib/constants";

export async function signOutAndRedirect() {
  const response = await fetch(`${API_URL}/api/auth/sign-out`, {
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