import { Router } from "express";
import {
  addContentRequestAssignees,
  createContentRequest,
  generateContentRequestTasks,
  getAllContentRequests,
  getContentRequestById,
  patchContentRequestStatus,
  updateContentRequest,
} from "./contentRequest.controller.js";

const router = Router();

router.get("/", getAllContentRequests);
router.get("/:id", getContentRequestById);
router.post("/", createContentRequest);
router.put("/:id", updateContentRequest);
router.patch("/:id/status", patchContentRequestStatus);
router.post("/:id/assignees", addContentRequestAssignees);
router.post("/:id/generate-tasks", generateContentRequestTasks);

export default router;
