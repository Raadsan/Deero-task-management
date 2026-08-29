import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, "../src");

const MAPPINGS = [
  {
    controller: "taskcontroller.js",
    router: "taskrouter.js",
    targetDir: "modules/tasks/tasks",
    ctrlName: "task.controller.js",
    routerName: "task.routes.js",
  },
  {
    controller: "recurringcontroller.js",
    router: "recurringrouter.js",
    targetDir: "modules/tasks/recurring",
    ctrlName: "recurring.controller.js",
    routerName: "recurring.routes.js",
  },
  {
    controller: "workflowtemplatecontroller.js",
    router: "workflowtemplaterouter.js",
    targetDir: "modules/tasks/workflows",
    ctrlName: "workflowTemplate.controller.js",
    routerName: "workflowTemplate.routes.js",
  },
  {
    controller: "trackingcontroller.js",
    router: "trackingrouter.js",
    targetDir: "modules/tasks/tracking",
    ctrlName: "tracking.controller.js",
    routerName: "tracking.routes.js",
  },
  {
    controller: "jobcontroller.js",
    router: "jobrouter.js",
    targetDir: "modules/tasks/jobs",
    ctrlName: "job.controller.js",
    routerName: "job.routes.js",
  },
  {
    controller: "contentrequestcontroller.js",
    router: "contentrequestrouter.js",
    targetDir: "modules/tasks/contentRequests",
    ctrlName: "contentRequest.controller.js",
    routerName: "contentRequest.routes.js",
  },
  {
    controller: "clientcontroller.js",
    router: "clientrouter.js",
    targetDir: "modules/clients/clients",
    ctrlName: "client.controller.js",
    routerName: "client.routes.js",
  },
  {
    controller: "contractcontroller.js",
    router: "contractrouter.js",
    targetDir: "modules/clients/contracts",
    ctrlName: "contract.controller.js",
    routerName: "contract.routes.js",
  },
  {
    controller: "servicecontroller.js",
    router: "servicerouter.js",
    targetDir: "modules/clients/services",
    ctrlName: "service.controller.js",
    routerName: "service.routes.js",
  },
  {
    controller: "portfoliocontroller.js",
    router: "portfoliorouter.js",
    targetDir: "modules/clients/portfolios",
    ctrlName: "portfolio.controller.js",
    routerName: "portfolio.routes.js",
  },
  {
    controller: "departmentcontroller.js",
    router: "departmentrouter.js",
    targetDir: "modules/clients/departments",
    ctrlName: "department.controller.js",
    routerName: "department.routes.js",
  },
  {
    controller: "projectcontroller.js",
    router: "projectrouter.js",
    targetDir: "modules/clients/projects",
    ctrlName: "project.controller.js",
    routerName: "project.routes.js",
  },
  {
    controller: "quotationcontroller.js",
    router: "quotationrouter.js",
    targetDir: "modules/quotations/quotations",
    ctrlName: "quotation.controller.js",
    routerName: "quotation.routes.js",
  },
  {
    controller: "documenttemplatecontroller.js",
    router: "documenttemplaterouter.js",
    targetDir: "modules/quotations/templates",
    ctrlName: "documentTemplate.controller.js",
    routerName: "documentTemplate.routes.js",
  },
  {
    controller: "staffcontroller.js",
    router: "staffrouter.js",
    targetDir: "modules/staff/staff",
    ctrlName: "staff.controller.js",
    routerName: "staff.routes.js",
  },
  {
    controller: "rolecontroller.js",
    router: "rolerouter.js",
    targetDir: "modules/staff/roles",
    ctrlName: "role.controller.js",
    routerName: "role.routes.js",
  },
  {
    controller: "navmenucontroller.js",
    router: "navmenurouter.js",
    targetDir: "modules/staff/menus",
    ctrlName: "navmenu.controller.js",
    routerName: "navmenu.routes.js",
  },
  {
    controller: "authcontroller.js",
    router: "authrouter.js",
    targetDir: "modules/staff/auth",
    ctrlName: "auth.controller.js",
    routerName: "auth.routes.js",
  },
  {
    controller: "notificationcontroller.js",
    router: "notificationrouter.js",
    targetDir: "modules/staff/notifications",
    ctrlName: "notification.controller.js",
    routerName: "notification.routes.js",
  },
  {
    controller: "billingcontroller.js",
    router: "billingrouter.js",
    targetDir: "modules/billing/billing",
    ctrlName: "billing.controller.js",
    routerName: "billing.routes.js",
  },
  {
    controller: "transactioncontroller.js",
    router: "transactionrouter.js",
    targetDir: "modules/billing/transactions",
    ctrlName: "transaction.controller.js",
    routerName: "transaction.routes.js",
  },
  {
    controller: "salarycontroller.js",
    router: "salaryrouter.js",
    targetDir: "modules/billing/salaries",
    ctrlName: "salary.controller.js",
    routerName: "salary.routes.js",
  },
];

function transform(code) {
  return code
    .replace(/from\s+["']\.\.\/lib\//g, 'from "../../../lib/')
    .replace(/from\s+["']\.\.\/data\//g, 'from "../../../data/')
    .replace(/from\s+["']\.\.\/middleware\//g, 'from "../../../middleware/')
    .replace(/from\s+["']\.\.\/middlewares\//g, 'from "../../../middlewares/')
    .replace(/from\s+["']\.\.\/utils\//g, 'from "../../../utils/')
    .replace(/from\s+["']\.\.\/config\//g, 'from "../../../config/');
}

for (const m of MAPPINGS) {
  const targetDirPath = path.join(srcDir, m.targetDir);
  fs.mkdirSync(targetDirPath, { recursive: true });

  // Migrate controller
  const srcCtrl = path.join(srcDir, "controllers", m.controller);
  if (fs.existsSync(srcCtrl)) {
    let ctrlContent = fs.readFileSync(srcCtrl, "utf-8");
    ctrlContent = transform(ctrlContent);
    fs.writeFileSync(path.join(targetDirPath, m.ctrlName), ctrlContent, "utf-8");
  }

  // Migrate router
  const srcRouter = path.join(srcDir, "routes", m.router);
  if (fs.existsSync(srcRouter)) {
    let routerContent = fs.readFileSync(srcRouter, "utf-8");
    routerContent = transform(routerContent);
    routerContent = routerContent.replace(new RegExp(`from\\s+["']\\.\\./controllers/${m.controller}["']`, "g"), `from "./${m.ctrlName}"`);
    fs.writeFileSync(path.join(targetDirPath, m.routerName), routerContent, "utf-8");
  }
}

console.log("Migration to modules completed with all data and lib paths converted!");
