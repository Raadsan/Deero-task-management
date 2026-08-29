import express from "express";
import taskRoutes from "./tasks/task.routes.js";
import recurringRoutes from "./recurring/recurring.routes.js";
import workflowTemplateRoutes from "./workflows/workflowTemplate.routes.js";
import trackingRoutes from "./tracking/tracking.routes.js";
import jobRoutes from "./jobs/job.routes.js";
import contentRequestRoutes from "./contentRequests/contentRequest.routes.js";

const router = express.Router();

export {
  taskRoutes,
  recurringRoutes,
  workflowTemplateRoutes,
  trackingRoutes,
  jobRoutes,
  contentRequestRoutes,
};

export default router;
