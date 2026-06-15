import { Router } from "express";
import {
  createUser,
  deleteUser,
  deleteUserFile,
  getAllUsers,
  getUserById,
  getUserFiles,
  updateUser,
  uploadUserFiles,
} from "../controllers/usercontroller.js";

const router = Router();

router.get("/", getAllUsers);
router.get("/:id/files", getUserFiles);
router.post("/:id/files", uploadUserFiles);
router.delete("/:id/files/:fileId", deleteUserFile);
router.get("/:id", getUserById);
router.post("/", createUser);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

export default router;
