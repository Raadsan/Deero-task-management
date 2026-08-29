import { Router } from "express";
import { getAllLogs } from "./tracking.controller.js";

const router = Router();

router.get("/all", getAllLogs);

export default router;
