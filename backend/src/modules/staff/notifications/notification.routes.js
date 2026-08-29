import { Router } from "express";
import { getNotifications, markAsSeen } from "./notification.controller.js";

const router = Router();

router.get("/", getNotifications);
router.put("/:id/seen", markAsSeen);

export default router;
