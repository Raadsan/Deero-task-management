import accountingRoutes from "./accounting/accounting.routes.js";
import quotationRoutes from "./accounting/receivables/quotations/quotation.routes.js";
import documentTemplateRoutes from "./accounting/configuration/documentTemplates/documentTemplate.routes.js";
import {
  taskRoutes,
  recurringRoutes,
  workflowTemplateRoutes,
  trackingRoutes,
  jobRoutes,
  contentRequestRoutes,
} from "./tasks/tasks.routes.js";
import {
  clientRoutes,
  contractRoutes,
  serviceRoutes,
  portfolioRoutes,
  departmentRoutes,
  projectRoutes,
} from "./clients/clients.routes.js";
import {
  staffRoutes,
  roleRoutes,
  navMenuRoutes,
  authRoutes,
  notificationRoutes,
} from "./staff/staff.routes.js";
import utilRoutes from "./shared/utils/util.routes.js";

export {
  // Accounting Module (includes Quotations & Document Templates)
  accountingRoutes,
  quotationRoutes,
  documentTemplateRoutes,
  // Tasks Module
  taskRoutes,
  recurringRoutes,
  workflowTemplateRoutes,
  trackingRoutes,
  jobRoutes,
  contentRequestRoutes,
  // Clients Module
  clientRoutes,
  contractRoutes,
  serviceRoutes,
  portfolioRoutes,
  departmentRoutes,
  projectRoutes,
  // Staff & Auth Module
  staffRoutes,
  roleRoutes,
  navMenuRoutes,
  authRoutes,
  notificationRoutes,
  // Shared Module
  utilRoutes,
};
