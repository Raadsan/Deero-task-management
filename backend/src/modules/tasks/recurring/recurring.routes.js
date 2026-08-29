import { Router } from "express";
import {
  createRecurringSchedule,
  deleteRecurringSchedule,
  generateRecurringCycle,
  getAllRecurringSchedules,
  getRecurringCycles,
  getRecurringOccurrences,
  getRecurringScheduleById,
  runRecurringDailyGeneration,
  toggleRecurringSchedule,
  updateRecurringSchedule,
} from "./recurring.controller.js";

const router = Router();

router.get("/", getAllRecurringSchedules);
router.post("/", createRecurringSchedule);
router.get("/:id/cycles", getRecurringCycles);
router.get("/:id/occurrences", getRecurringOccurrences);
router.post("/:id/run-daily", runRecurringDailyGeneration);
router.post("/:id/cycles/generate", generateRecurringCycle);
router.patch("/:id/toggle", toggleRecurringSchedule);
router.get("/:id", getRecurringScheduleById);
router.put("/:id", updateRecurringSchedule);
router.delete("/:id", deleteRecurringSchedule);

export default router;
