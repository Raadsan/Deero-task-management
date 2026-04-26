import { Router } from "express";
import { getAllRoles, createRole, deleteRole } from "../controllers/rolecontroller.js";

const router = Router();

router.get("/", getAllRoles);
router.post("/", createRole);
router.delete("/:id", deleteRole);

export default router;
