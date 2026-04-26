// This is a placeholder to prevent build errors.
// In a separated frontend/backend architecture, the frontend should use API calls.
export const prisma = new Proxy({}, {
  get: () => {
    throw new Error("Direct Prisma access is disabled in the frontend. Use API calls to the backend instead.");
  }
}) as any;
