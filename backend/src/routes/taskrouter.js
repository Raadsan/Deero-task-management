import { Router } from "express";
import { getAllTasks, getTaskById, createTask, updateTask, deleteTask, getMonthlyGraphData, getYearlyGraphData, getDashboardMetrics, getTasksReport } from "../controllers/taskcontroller.js";

const router = Router();

router.get("/graph/monthly", getMonthlyGraphData);
router.get("/graph/yearly", getYearlyGraphData);
router.get("/metrics", getDashboardMetrics);
router.get("/", getAllTasks);
router.get("/:id", getTaskById);
router.get("/report/data", getTasksReport);
router.post("/", createTask);
router.put("/:id", updateTask);
router.delete("/:id", deleteTask);

export default router;
