import { Router } from "express";
import { getNotifications, markAsSeen } from "../controllers/notificationcontroller.js";

const router = Router();

router.get("/", getNotifications);
router.put("/:id/seen", markAsSeen);

export default router;
