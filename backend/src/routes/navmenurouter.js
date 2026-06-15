import { Router } from "express";
import {
  createMenu,
  createSubMenu,
  deleteMenu,
  deleteSubMenu,
  getAllMenus,
  getMenusByRole,
  getRolePermissionMatrix,
  seedDefaultMenus,
  updateMenu,
  updatePermissions,
  updateSubMenu,
} from "../controllers/navmenucontroller.js";

const router = Router();

router.get("/permissions-matrix/:roleId", getRolePermissionMatrix);
router.get("/role/:roleId", getMenusByRole);
router.post("/seed", seedDefaultMenus);
router.post("/permissions/:roleId", updatePermissions);
router.get("/", getAllMenus);
router.post("/", createMenu);
router.put("/:id", updateMenu);
router.delete("/:id", deleteMenu);
router.post("/sub", createSubMenu);
router.put("/sub/:id", updateSubMenu);
router.delete("/sub/:id", deleteSubMenu);

export default router;
