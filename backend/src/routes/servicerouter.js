import { Router } from "express";
import {
  createService,
  createSubService,
  deleteService,
  deleteSubService,
  getAllServices,
  getServiceById,
  getSubServicesByServiceId,
  updateService,
  updateSubService,
} from "../controllers/servicecontroller.js";

const router = Router();

router.get("/", getAllServices);
router.post("/", createService);
router.post("/sub", createSubService);
router.put("/sub/:id", updateSubService);
router.delete("/sub/:id", deleteSubService);
router.get("/:id/subservices", getSubServicesByServiceId);
router.get("/:id", getServiceById);
router.put("/:id", updateService);
router.delete("/:id", deleteService);

export default router;
