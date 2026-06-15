export function isMainBranch(
  branch?: { isMain?: boolean; usesRootLogin?: boolean } | null,
) {
  return Boolean(branch?.isMain || branch?.usesRootLogin);
}
