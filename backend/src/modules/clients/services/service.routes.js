import { Router } from "express";
import {
  createService,
  createSubService,
  deleteService,
  deleteSubService,
  getAllServices,
  getAllSubServices,
  getServiceById,
  getSubServicesByServiceId,
  updateService,
  updateSubService,
  syncAdvertServices,
} from "./service.controller.js";

const router = Router();

router.get("/", getAllServices);
router.get("/sub/all", getAllSubServices);
router.post("/", createService);
router.post("/sync-advert", syncAdvertServices);
router.post("/sub", createSubService);
router.put("/sub/:id", updateSubService);
router.delete("/sub/:id", deleteSubService);
router.get("/:id/subservices", getSubServicesByServiceId);
router.get("/:id", getServiceById);
router.put("/:id", updateService);
router.delete("/:id", deleteService);

export default router;
