import { Router } from "express";
import {
  createOrUpdateSchema,
  deleteSchema,
  getAllSchemas,
  getSchemaById,
} from "../controllers/schemacontroller.js";

const router = Router();

router.get("/", getAllSchemas);
router.post("/", createOrUpdateSchema);
router.get("/:id", getSchemaById);
router.put("/:id", createOrUpdateSchema);
router.delete("/:id", deleteSchema);

export default router;
