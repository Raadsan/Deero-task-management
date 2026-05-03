import { Router } from "express";
import { getAllClients, getClientById, createClient, updateClient, deleteClient, getClientSourcesData, deleteClientAgreement, updateClientAgreement } from "../controllers/clientcontroller.js";

const router = Router();

router.get("/", getAllClients);
router.get("/sources/info", getClientSourcesData);
router.get("/:id", getClientById);
router.post("/", createClient);
router.put("/:id", updateClient);
router.delete("/:id", deleteClient);
router.delete("/agreement/:agreementId", deleteClientAgreement);
router.put("/agreement/:agreementId", updateClientAgreement);

export default router;
