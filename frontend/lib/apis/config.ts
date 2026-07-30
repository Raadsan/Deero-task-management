export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:7003"
).replace(/[\'\"]/g, "");

export function resolveApiAssetUrl(path?: string | null): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
