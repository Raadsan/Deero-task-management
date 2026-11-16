import { Router } from "express";
import {
  advanceProjectStatus,
  createProject,
  deleteProject,
  generateProjectTasks,
  getAllProjects,
  getProjectById,
  updateProject,
} from "./project.controller.js";
import {
  archiveProject,
  createExtraRequest,
  decideExtraRequest,
  getProjectSummary,
  reassignProjectTask,
  registerProject,
  startNextCycle,
  projectDetailInclude,
} from "./project-registration.controller.js";
import { prisma } from "../../../lib/prisma.js";
import { getScope, mergeWhere, projectBranchWhere } from "../../../lib/portfolio-scope.js";

const router = Router();

router.get("/summary", getProjectSummary);
router.post("/register", registerProject);
router.get("/", getAllProjects);
router.get("/:id", async (req, res, next) => {
  try {
    const scope = getScope(req);
    const project = await prisma.project.findFirst({
      where: mergeWhere({ id: req.params.id }, projectBranchWhere(scope)),
      include: projectDetailInclude,
    });
    if (!project) return res.status(404).json({ success: false, error: "Project not found" });
    return res.json({ success: true, data: project });
  } catch (error) {
    if (error?.message?.includes("Unknown field") || error?.code === "P2022") {
      return getProjectById(req, res, next);
    }
    return res.status(500).json({ success: false, error: error.message });
  }
});
router.post("/", createProject);
router.put("/:id", updateProject);
router.delete("/:id", deleteProject);
router.post("/:id/advance", advanceProjectStatus);
router.post("/:id/generate-tasks", generateProjectTasks);
router.post("/:id/archive", archiveProject);
router.post("/:id/extra-requests", createExtraRequest);
router.post("/:id/extra-requests/:requestId/decision", decideExtraRequest);
router.post("/:id/cycles", startNextCycle);
router.post("/:id/tasks/:taskId/reassign", reassignProjectTask);

export default router;
