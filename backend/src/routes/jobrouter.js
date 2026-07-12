import { Router } from "express";
import {
  runGenerateMonthlyBilling,
  runGenerateRecurringTasks,
} from "../controllers/jobcontroller.js";

const router = Router();

router.post("/generate-recurring-tasks", runGenerateRecurringTasks);
router.post("/generate-monthly-billing", runGenerateMonthlyBilling);

export default router;
