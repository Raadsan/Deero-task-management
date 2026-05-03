import { Router } from "express";
import { getAllUsers, getUserById, createUser, updateUser } from "../controllers/usercontroller.js";

const router = Router();

router.get("/", getAllUsers);
router.get("/:id", getUserById);
router.post("/", createUser);
router.put("/:id", updateUser);

export default router;
