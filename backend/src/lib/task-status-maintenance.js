import { prisma as defaultPrisma } from "./prisma.js";

let maintenancePromise = null;
let lastMaintenanceAt = 0;
const MIN_MAINTENANCE_MS = 45_000;

function isLockTimeout(error) {
  const message = String(error?.message || "");
  return message.includes("Lock wait timeout") || message.includes("1205");
}

/**
 * Single-flight task status maintenance (overdue + lifecycle + project schedule).
 * Avoids overlapping updateMany/UPDATE calls that cause MySQL lock wait timeouts.
 */
export async function runTaskStatusMaintenance(prisma = defaultPrisma, { force = false } = {}) {
  const now = Date.now();
  if (!force && now - lastMaintenanceAt < MIN_MAINTENANCE_MS) {
    return { skipped: true, reason: "throttled" };
  }
  if (maintenancePromise) {
    return maintenancePromise;
  }

  maintenancePromise = (async () => {
    try {
      const { syncOverdueTasks } = await import("./task-status.js");
      const { syncTaskLifecycleStatuses } = await import("./task-lifecycle.js");
      const { syncScheduledTaskActivation } = await import("./scheduled-task-window.js");

      await syncOverdueTasks(prisma);
      const standalone = await syncTaskLifecycleStatuses(prisma);
      const project = await syncScheduledTaskActivation(prisma);
      lastMaintenanceAt = Date.now();
      return { skipped: false, updated: standalone + project };
    } catch (error) {
      if (isLockTimeout(error)) {
        console.warn("[task-maintenance] Skipped — database lock timeout (will retry later)");
        return { skipped: true, reason: "lock_timeout" };
      }
      throw error;
    } finally {
      maintenancePromise = null;
    }
  })();

  return maintenancePromise;
}

/** Non-blocking maintenance for hot API paths (does not await). */
export function requestTaskStatusMaintenance(prisma = defaultPrisma) {
  void runTaskStatusMaintenance(prisma).catch((error) => {
    if (!isLockTimeout(error)) {
      console.error("[task-maintenance] Failed:", error.message);
    }
  });
}