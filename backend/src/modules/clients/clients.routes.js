import express from "express";
import clientRoutes from "./clients/client.routes.js";
import contractRoutes from "./contracts/contract.routes.js";
import serviceRoutes from "./services/service.routes.js";
import portfolioRoutes from "./portfolios/portfolio.routes.js";
import departmentRoutes from "./departments/department.routes.js";
import projectRoutes from "./projects/project.routes.js";

const router = express.Router();

export {
  clientRoutes,
  contractRoutes,
  serviceRoutes,
  portfolioRoutes,
  departmentRoutes,
  projectRoutes,
};

export default router;
