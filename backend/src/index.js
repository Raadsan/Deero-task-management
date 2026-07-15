// import dotenv from "dotenv";
// dotenv.config();
// import express from "express";
// import cors from "cors";
// import { auth } from "./lib/auth.js";
// import { toNodeHandler } from "better-auth/node";
// import userRoutes from "./routes/userrouter.js";
// import authRoutes from "./routes/authrouter.js";
// import clientRoutes from "./routes/clientrouter.js";
// import taskRoutes from "./routes/taskrouter.js";
// import serviceRoutes from "./routes/servicerouter.js";
// import transactionRoutes from "./routes/transactionrouter.js";
// import salaryRoutes from "./routes/salaryrouter.js";
// import roleRoutes from "./routes/rolerouter.js";
// import utilRoutes from "./routes/utilrouter.js";
// import notificationRoutes from "./routes/notificationrouter.js";



// const app = express();
// const port = process.env.PORT || 700;

// app.use(cors({
//   origin: process.env.FRONTEND_URL || "http://localhost:3000",
//   credentials: true
// }));
// app.use(express.json());

// // Better Auth integration
// app.all("/api/auth/*", toNodeHandler(auth));

// // Routes
// app.use("/api/staffs", userRoutes);
// app.use("/api/auth-custom", authRoutes);
// app.use("/api/clients", clientRoutes);
// app.use("/api/tasks", taskRoutes);
// app.use("/api/services", serviceRoutes);
// app.use("/api/transactions", transactionRoutes);
// app.use("/api/salaries", salaryRoutes);
// app.use("/api/roles", roleRoutes);
// app.use("/api/utils", utilRoutes);
// app.use("/api/notifications", notificationRoutes);

// app.get("/", (req, res) => {
//   res.send("Deero Management API is running...");
// });

// app.listen(port, () => {
//   console.log(`Server is running on port ${port}`);
// });





import dotenv from "dotenv";
dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

const frontendUrl = isProduction
  ? process.env.FRONTEND_URL_PROD
  : process.env.FRONTEND_URL;

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { auth } from "./lib/auth.js";
import { toNodeHandler } from "better-auth/node";

import staffRoutes from "./routes/staffrouter.js";
import authRoutes from "./routes/authrouter.js";
import clientRoutes from "./routes/clientrouter.js";
import taskRoutes from "./routes/taskrouter.js";
import serviceRoutes from "./routes/servicerouter.js";
import transactionRoutes from "./routes/transactionrouter.js";
import salaryRoutes from "./routes/salaryrouter.js";
import roleRoutes from "./routes/rolerouter.js";
import utilRoutes from "./routes/utilrouter.js";
import notificationRoutes from "./routes/notificationrouter.js";
import portfolioRoutes from "./routes/portfoliorouter.js";
import navMenuRoutes from "./routes/navmenurouter.js";
import trackingRoutes from "./routes/trackingrouter.js";
import projectRoutes from "./routes/projectrouter.js";
import contentRequestRoutes from "./routes/contentrequestrouter.js";
import recurringRoutes from "./routes/recurringrouter.js";
import workflowTemplateRoutes from "./routes/workflowtemplaterouter.js";
import contractRoutes from "./routes/contractrouter.js";
import billingRoutes from "./routes/billingrouter.js";
import jobRoutes from "./routes/jobrouter.js";
import { attachSessionScope } from "./middleware/session-scope.js";

const app = express();
const port = process.env.PORT || 7003;

app.use(cors({
  origin: [
    "http://localhost:2003",
    "http://127.0.0.1:2003",
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));

app.use(express.json({ limit: "5mb" }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.all("/api/auth/*", toNodeHandler(auth));

app.use("/api/staffs", attachSessionScope, staffRoutes);
app.use("/api/auth-custom", authRoutes);
app.use("/api/clients", attachSessionScope, clientRoutes);
app.use("/api/projects", attachSessionScope, projectRoutes);
app.use("/api/content-requests", attachSessionScope, contentRequestRoutes);
app.use("/api/recurring-schedules", attachSessionScope, recurringRoutes);
app.use("/api/contracts", attachSessionScope, contractRoutes);
app.use("/api/billing", attachSessionScope, billingRoutes);
app.use("/api/workflow-templates", attachSessionScope, workflowTemplateRoutes);
app.use("/api/jobs", attachSessionScope, jobRoutes);
app.use("/api/tasks", attachSessionScope, taskRoutes);
app.use("/api/services", attachSessionScope, serviceRoutes);
app.use("/api/portfolios", attachSessionScope, portfolioRoutes);
app.use("/api/nav-menus", attachSessionScope, navMenuRoutes);
app.use("/api/tracking", attachSessionScope, trackingRoutes);
app.use("/api/transactions", attachSessionScope, transactionRoutes);
app.use("/api/salaries", attachSessionScope, salaryRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/utils", utilRoutes);
app.use("/api/notifications", notificationRoutes);

app.get("/", (req, res) => {
  res.send("Deero Management API is running...");
});

// 👇 muhiim
app.listen(port, "0.0.0.0", async () => {
  console.log(`Server is running on port ${port}`);
  try {
    const { ensureDefaultMenusOnStartup } = await import(
      "./controllers/navmenucontroller.js"
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
        const result = await generateDailyRecurringTasks();
        if (result.created > 0) {
          console.log(
            `[recurring-job] Created ${result.created} task(s) for ${result.runDate}`,
          );
        }
      } catch (err) {
        console.error("[recurring-job] Failed:", err.message);
      }
    };
    await runRecurringJob();
    setInterval(runRecurringJob, 60 * 60 * 1000);
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
});
