const isProduction = process.env.NODE_ENV === "production";
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { auth } from "./lib/auth.js";
import { toNodeHandler } from "better-auth/node";
import { createHash } from "crypto";

import {
  accountingRoutes,
  taskRoutes,
  recurringRoutes,
  workflowTemplateRoutes,
  trackingRoutes,
  jobRoutes,
  contentRequestRoutes,
  clientRoutes,
  contractRoutes,
  serviceRoutes,
  portfolioRoutes,
  departmentRoutes,
  projectRoutes,
  quotationRoutes,
  documentTemplateRoutes,
  staffRoutes,
  roleRoutes,
  navMenuRoutes,
  authRoutes,
  notificationRoutes,
  utilRoutes,
} from "./modules/index.js";
import { attachSessionScope } from "./middlewares/session-scope.js";
import { prisma } from "./lib/prisma.js";
import { syncOverdueTasks } from "./lib/task-status.js";

const app = express();
const port = process.env.PORT || 7003;

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (like curl, postman, server-to-server)
    if (!origin) return callback(null, true);

    const allowedHosts = [
      "localhost",
      "127.0.0.1",
      "178.18.241.5",
      "deero.so",
    ];

    const isAllowed = allowedHosts.some((host) => origin.includes(host)) || origin === frontendUrl;
    if (isAllowed) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Session-level in-memory cache to avoid DB hits on every SSR page load
const sessionCache = new Map();
const SESSION_CACHE_MS = 5000; // 5 seconds

app.get("/api/auth/get-session", (req, res, next) => {
  const cookieHeader = req.headers.cookie || "";
  if (!cookieHeader) return next();

  const cacheKey = createHash("sha256").update(cookieHeader).digest("hex");
  const cached = sessionCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < SESSION_CACHE_MS) {
    res.set("X-Session-Cache", "HIT");
    return res.json(cached.data);
  }

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode < 400 && body) {
      sessionCache.set(cacheKey, { createdAt: Date.now(), data: body });
      if (sessionCache.size > 200) {
        sessionCache.delete(sessionCache.keys().next().value);
      }
    }
    return originalJson(body);
  };
  next();
});

const authHandler = toNodeHandler(auth);
app.all("/api/auth/*", (req, res, next) => {
  void authHandler(req, res)
    .then(() => {
      // Better Auth can write a successful response without ending the
      // chunked stream when hosted by Express. Close it explicitly.
      if (!res.writableEnded) res.end();
    })
    .catch(next);
});

app.use("/api/staffs", attachSessionScope, staffRoutes);
app.use("/api/auth-custom", authRoutes);
app.use("/api/clients", attachSessionScope, clientRoutes);
app.use("/api/projects", attachSessionScope, projectRoutes);
app.use("/api/content-requests", attachSessionScope, contentRequestRoutes);
app.use("/api/recurring-schedules", attachSessionScope, recurringRoutes);
app.use("/api/contracts", attachSessionScope, contractRoutes);

app.use("/api/workflow-templates", attachSessionScope, workflowTemplateRoutes);
app.use("/api/jobs", attachSessionScope, jobRoutes);
app.use("/api/tasks", attachSessionScope, taskRoutes);
app.use("/api/services", attachSessionScope, serviceRoutes);
app.use("/api/portfolios", attachSessionScope, portfolioRoutes);
app.use("/api/nav-menus", attachSessionScope, navMenuRoutes);
app.use("/api/tracking", attachSessionScope, trackingRoutes);
app.use("/api/quotations", attachSessionScope, quotationRoutes);
app.use("/api/document-templates", attachSessionScope, documentTemplateRoutes);
app.use("/api/accounting", attachSessionScope, accountingRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/utils", utilRoutes);
app.use("/api/notifications", notificationRoutes);

app.get("/", (req, res) => {
  res.send("Deero Management API is running...");
});

const runOverdueSync = () => {
  void syncOverdueTasks(prisma).catch((error) => {
    console.error("[overdue-job] Failed:", error.message);
  });
};
setTimeout(runOverdueSync, 30_000);
setInterval(runOverdueSync, 5 * 60 * 1000);

// 👇 muhiim
app.listen(port, async () => {
  console.log(`Server is running on port ${port}`);
  try {
    const { ensureDefaultMenusOnStartup } = await import(
      "./modules/staff/menus/navmenu.controller.js"
    );
    await ensureDefaultMenusOnStartup();
  } catch (error) {
    const message = error?.message ?? String(error);
    if (message.includes("Too many connections")) {
      console.warn(
        "Skipped nav menu startup sync: database connection limit reached. Restart backend once other instances are stopped.",
      );
    } else {
      console.error("Failed to seed default nav menus on startup:", error);
    }
  }

  try {
    const { generateDailyRecurringTasks } = await import(
      "./lib/recurring-task-generator.js"
    );
    const runRecurringJob = async () => {
      try {
        const now = new Date();
        const result = await generateDailyRecurringTasks({ runDate: now });
        let lookaheadCreated = 0;
        const lookahead = new Date(now.getTime() + 60 * 60 * 1000);
        // Only run lookahead if it crosses into tomorrow (midnight)
        if (lookahead.getDate() !== now.getDate()) {
          const lookaheadResult = await generateDailyRecurringTasks({ runDate: lookahead });
          lookaheadCreated = lookaheadResult.created || 0;
        }
        const totalCreated = (result.created || 0) + lookaheadCreated;
        if (totalCreated > 0) {
          console.log(
            `[recurring-job] Created ${totalCreated} task(s)`,
          );
        }
      } catch (err) {
        console.error("[recurring-job] Failed:", err.message);
      }
    };
    await runRecurringJob();
    setInterval(runRecurringJob, 5 * 60 * 1000);

    // Auto-notify assignees when pending task startDate is reached
    const { prisma } = await import("./lib/prisma.js");
    const autoTransitionJob = async () => {
      try {
        const now = new Date();
        const startingTasks = await prisma.task.findMany({
          where: {
            status: "pending",
            workflowStage: "pending",
            startDate: { lte: now },
            progress: 0,
          },
          select: { id: true, assgineeId: true, serviceInformation: true, description: true, deadline: true },
          take: 30,
        });
        if (startingTasks.length > 0) {
          const ids = startingTasks.map((t) => t.id);
          // Flip all to in_progress via workflowStage (status enum has no in_progress)
          await prisma.task.updateMany({
            where: { id: { in: ids } },
            data: { workflowStage: "in_progress" },
          });
          console.log(`[auto-transition] Transitioned ${ids.length} task(s) to in_progress`);

          // Send notification to each assignee
          for (const task of startingTasks) {
            try {
              const existingNotif = await prisma.notification.findFirst({
                where: { taskId: task.id, type: "status-in_progress" },
                select: { id: true },
              });
              if (!existingNotif) {
                const taskName = `${(task.serviceInformation || task.description || "Task").substring(0, 60)} (started)`;
                await prisma.notification.create({
                  data: {
                    id: Math.random().toString(36).substring(2, 15),
                    taskId: task.id,
                    taskName,
                    assigneeName: "",
                    deadline: task.deadline || now,
                    type: "status-in_progress",
                    userId: task.assgineeId,
                    isSeen: false,
                  },
                });
              }
            } catch (_) {}
          }
        }
      } catch (err) {
        console.error("[auto-transition] Failed:", err.message);
      }
    };
    await autoTransitionJob();
    setInterval(autoTransitionJob, 60 * 1000); // Run every 1 minute
  } catch (error) {
    console.error("Failed to start recurring task scheduler:", error);
  }

  try {
    const { generateMonthlyInstallments } = await import(
      "./lib/monthly-billing-generator.js"
    );
    const runBillingJob = async () => {
      try {
        const result = await generateMonthlyInstallments();
        if (result.created > 0 || result.updated > 0) {
          console.log(
            `[billing-job] Created ${result.created}, updated ${result.updated} installment(s) for ${result.periodYear}-${String(result.periodMonth).padStart(2, "0")}`,
          );
        }
      } catch (err) {
        console.error("[billing-job] Failed:", err.message);
      }
    };
    await runBillingJob();
    setInterval(runBillingJob, 60 * 60 * 1000);
  } catch (error) {
    console.error("Failed to start monthly billing scheduler:", error);
  }

  try {
    const { checkAndNotifyOverdueTasks } = await import(
      "./lib/overdue-checker.js"
    );
    const runOverdueJob = async () => {
      try {
        await checkAndNotifyOverdueTasks();
      } catch (err) {
        console.error("[overdue-job] Failed:", err.message);
      }
    };
    await runOverdueJob();
    // Run every 10 minutes
    setInterval(runOverdueJob, 10 * 60 * 1000);
  } catch (error) {
    console.error("Failed to start overdue task checker:", error);
  }
});
