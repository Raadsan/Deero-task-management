import { Router } from "express";
import {
  createContract,
  deleteContract,
  getAllContracts,
  getContractById,
  getContractDocuments,
  updateContract,
  uploadContractDocument,
} from "./contract.controller.js";

const router = Router();

router.get("/", getAllContracts);
router.post("/", createContract);
router.get("/:id/documents", getContractDocuments);
router.post("/:id/documents", uploadContractDocument);
router.get("/:id", getContractById);
router.put("/:id", updateContract);
router.delete("/:id", deleteContract);

export default router;
