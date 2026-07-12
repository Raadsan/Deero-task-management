import { Router } from "express";
import {
  getAllClients,
  getClientById,
  createClient,
  addClientService,
  updateClient,
  deleteClient,
  getClientSourcesData,
  getClientMetrics,
  deleteClientAgreement,
  updateClientAgreement,
} from "../controllers/clientcontroller.js";

const router = Router();

router.get("/", getAllClients);
router.get("/sources/info", getClientSourcesData);
router.get("/metrics", getClientMetrics);
router.get("/:id", getClientById);
router.post("/", createClient);
router.post("/:id/services", addClientService);
router.put("/:id", updateClient);
router.delete("/:id", deleteClient);
router.delete("/agreement/:agreementId", deleteClientAgreement);
router.put("/agreement/:agreementId", updateClientAgreement);

export default router;
