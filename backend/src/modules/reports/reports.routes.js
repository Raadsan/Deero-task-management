import { Router } from "express";
import { clientReport, employeeReport, taskReport } from "./performance-report.controller.js";

const router = Router();

router.get("/employees", employeeReport);
router.get("/clients", clientReport);
router.get("/tasks", taskReport);

export default router;
