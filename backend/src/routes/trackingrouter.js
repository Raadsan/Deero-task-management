import { Router } from "express";
import { getAllLogs } from "../controllers/trackingcontroller.js";

const router = Router();

router.get("/all", getAllLogs);

export default router;
