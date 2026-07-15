import { generateDailyRecurringTasks } from "../lib/recurring-task-generator.js";
import { generateMonthlyInstallments } from "../lib/monthly-billing-generator.js";
import { getScope } from "../lib/portfolio-scope.js";

function isAuthorizedJobRequest(req) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const header = req.headers["x-cron-secret"];
    return header === secret;
  }

  const role = (getScope(req).user?.role ?? "").toLowerCase();
  return role === "superadmin" || role === "admin";
}

export const runGenerateRecurringTasks = async (req, res) => {
  try {
    if (!isAuthorizedJobRequest(req)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const runDate = req.body?.date ? new Date(req.body.date) : new Date();
    const scheduleId = req.body?.scheduleId ?? null;

    const result = await generateDailyRecurringTasks({ runDate, scheduleId });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Recurring task job failed:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const runGenerateMonthlyBilling = async (req, res) => {
  try {
    if (!isAuthorizedJobRequest(req)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const runDate = req.body?.date ? new Date(req.body.date) : new Date();
    const result = await generateMonthlyInstallments({ runDate });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Monthly billing job failed:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
