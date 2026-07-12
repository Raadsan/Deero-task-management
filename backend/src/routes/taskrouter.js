import { Router } from "express";
import { getAllTasks, getMyTasks, getTaskById, createTask, updateTask, deleteTask, getMonthlyGraphData, getYearlyGraphData, getDashboardMetrics, getTasksReport } from "../controllers/taskcontroller.js";

const router = Router();

router.get("/graph/monthly", getMonthlyGraphData);
router.get("/graph/yearly", getYearlyGraphData);
router.get("/metrics", getDashboardMetrics);
router.get("/assigned/me", getMyTasks);
router.get("/mine", getMyTasks);
router.get("/", getAllTasks);
router.get("/report/data", getTasksReport);
router.get("/:id", getTaskById);
router.post("/", createTask);
router.put("/:id", updateTask);
router.delete("/:id", deleteTask);

export default router;
