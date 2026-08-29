import express from "express";
import {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  renderQuotationDocument,
  renderInvoiceDocument,
  uploadTemplateBackground,
} from "./documentTemplate.controller.js";
import { protect } from "../../../../middlewares/authMiddleware.js";

const router = express.Router();

// Document public rendering for printing / iframe / PDF download
router.get("/render/quotation/:id", renderQuotationDocument);
router.get("/render/invoice/:id", renderInvoiceDocument);

router.use(protect);

router.post("/upload", uploadTemplateBackground);
router.get("/", getAllTemplates);
router.get("/:id", getTemplateById);
router.post("/", createTemplate);
router.put("/:id", updateTemplate);
router.delete("/:id", deleteTemplate);

export default router;
