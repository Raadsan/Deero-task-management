import { Router } from "express";
import {
  getAllClients,
  getBasicClients,
  getClientById,
  createClient,
  addClientService,
  updateClient,
  deleteClient,
  getClientSourcesData,
  getClientMetrics,
  getClientFinancialSummary,
  deleteClientAgreement,
  updateClientAgreement,
} from "./client.controller.js";

const router = Router();

router.get("/", getAllClients);
router.get("/basic", getBasicClients);
router.get("/sources/info", getClientSourcesData);
router.get("/metrics", getClientMetrics);
router.get("/:id/financial-summary", getClientFinancialSummary);
router.get("/:id", getClientById);
router.post("/", createClient);
router.post("/:id/services", addClientService);
router.put("/:id", updateClient);
router.delete("/:id", deleteClient);
router.delete("/agreement/:agreementId", deleteClientAgreement);
router.put("/agreement/:agreementId", updateClientAgreement);

export default router;
