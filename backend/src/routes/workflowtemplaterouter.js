import { Router } from "express";
import {
  getAllWorkflowTemplates,
  getWorkflowTemplateById,
  seedWorkflowTemplates,
} from "../controllers/workflowtemplatecontroller.js";

const router = Router();

router.get("/", getAllWorkflowTemplates);
router.post("/seed", seedWorkflowTemplates);
router.get("/:id", getWorkflowTemplateById);

export default router;
