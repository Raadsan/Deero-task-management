import { Router } from "express";
import { getAllRoles, createRole, updateRole, deleteRole } from "../controllers/rolecontroller.js";

const router = Router();

router.get("/", getAllRoles);
router.post("/", createRole);
router.put("/:id", updateRole);
router.delete("/:id", deleteRole);

export default router;
