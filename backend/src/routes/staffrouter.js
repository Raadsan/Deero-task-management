import { Router } from "express";
import {
  createStaff,
  deleteStaff,
  deleteStaffFile,
  getAllStaff,
  getStaffById,
  getStaffFiles,
  updateStaff,
  uploadStaffFiles,
} from "../controllers/staffcontroller.js";

const router = Router();

router.get("/", getAllStaff);
router.get("/:id/files", getStaffFiles);
router.post("/:id/files", uploadStaffFiles);
router.delete("/:id/files/:fileId", deleteStaffFile);
router.get("/:id", getStaffById);
router.post("/", createStaff);
router.put("/:id", updateStaff);
router.delete("/:id", deleteStaff);

export default router;
