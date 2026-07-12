import { uploadToS3 } from "./s3-client.js";

export async function saveBranchLogo(branchId, logoData, variant = "logo") {
  if (!logoData || typeof logoData !== "string") return null;

  const matches = logoData.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) return null;

  const ext = matches[1] === "jpeg" ? "jpg" : matches[1];
  const buffer = Buffer.from(matches[2], "base64");

  if (buffer.length > 2 * 1024 * 1024) {
    throw new Error("Logo must be smaller than 2MB");
  }

  const safeVariant = variant === "icon" ? "icon" : "logo";
  const filename = `branches/${branchId}-${safeVariant}.${ext}`;
  const contentType = `image/${matches[1]}`;

  return await uploadToS3(filename, buffer, contentType);
}

/** Preserve case; only normalize spaces and invalid characters */
export function normalizeBranchSlug(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function slugifyBranchName(name) {
  return normalizeBranchSlug(name);
}

export const RESERVED_BRANCH_SLUGS = new Set([
  "auth",
  "users",
  "clients",
  "contracts",
  "payments",
  "reports",
  "recurring-schedules",
  "tasks",
  "services",
  "branches",
  "departments",
  "payments",
  "my-tasks",
  "profile",
  "invoice",
  "api",
  "settings",
  "config",
  "b",
]);

export function isReservedBranchSlug(slug) {
  return RESERVED_BRANCH_SLUGS.has(String(slug).toLowerCase());
}
