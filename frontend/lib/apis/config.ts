function stripQuotes(value: string) {
  return value.replace(/[\'\"]/g, "");
}

export const API_BACKEND_URL = stripQuotes(
  process.env.NEXT_PUBLIC_API_URL ||
    process.env.BETTER_AUTH_URL ||
    "http://localhost:7003",
);

/** Browser: same-origin `/api` (Next rewrites → backend). Server: direct backend URL. */
export const API_URL =
  typeof window !== "undefined" ? "" : API_BACKEND_URL;

export function resolveApiAssetUrl(path?: string | null): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base =
    typeof window !== "undefined" ? window.location.origin : API_BACKEND_URL;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
