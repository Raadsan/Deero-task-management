import fs from "fs/promises";
import path from "path";

const BRANCH_LOGO_DIR = path.join(process.cwd(), "uploads", "branches");

export async function saveBranchLogo(branchId, logoData, variant = "logo") {
  if (!logoData || typeof logoData !== "string") return null;

  const matches = logoData.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) return null;

  const ext = matches[1] === "jpeg" ? "jpg" : matches[1];
  const buffer = Buffer.from(matches[2], "base64");

  if (buffer.length > 2 * 1024 * 1024) {
    throw new Error("Logo must be smaller than 2MB");
  }

  await fs.mkdir(BRANCH_LOGO_DIR, { recursive: true });

  const safeVariant = variant === "icon" ? "icon" : "logo";
  const filename = `${branchId}-${safeVariant}.${ext}`;
  await fs.writeFile(path.join(BRANCH_LOGO_DIR, filename), buffer);

  return `/uploads/branches/${filename}`;
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
