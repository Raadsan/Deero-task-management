import { Router } from "express";
import { getAllServices, createService, createSubService, getSubServicesByServiceId } from "../controllers/servicecontroller.js";

const router = Router();

router.get("/", getAllServices);
router.get("/:id/subservices", getSubServicesByServiceId);
router.post("/", createService);
router.post("/sub", createSubService);

export default router;
