import { Router } from "express";
import {
  advanceProjectStatus,
  createProject,
  deleteProject,
  generateProjectTasks,
  getAllProjects,
  getProjectById,
  updateProject,
} from "../controllers/projectcontroller.js";

const router = Router();

router.get("/", getAllProjects);
router.get("/:id", getProjectById);
router.post("/", createProject);
router.put("/:id", updateProject);
router.delete("/:id", deleteProject);
router.post("/:id/advance", advanceProjectStatus);
router.post("/:id/generate-tasks", generateProjectTasks);

export default router;
