import { Router } from "express";
import {
  createRecurringSchedule,
  generateRecurringCycle,
  getAllRecurringSchedules,
  getRecurringCycles,
  getRecurringOccurrences,
  getRecurringScheduleById,
  runRecurringDailyGeneration,
  toggleRecurringSchedule,
} from "../controllers/recurringcontroller.js";

const router = Router();

router.get("/", getAllRecurringSchedules);
router.post("/", createRecurringSchedule);
router.get("/:id/cycles", getRecurringCycles);
router.get("/:id/occurrences", getRecurringOccurrences);
router.post("/:id/run-daily", runRecurringDailyGeneration);
router.post("/:id/cycles/generate", generateRecurringCycle);
router.patch("/:id/toggle", toggleRecurringSchedule);
router.get("/:id", getRecurringScheduleById);

export default router;
