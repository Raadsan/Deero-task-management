import express from "express";
import {
  getAllQuotations,
  getQuotationById,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  convertQuotationToInvoice,
} from "./quotation.controller.js";
import { protect } from "../../../../middlewares/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getAllQuotations);
router.get("/:id", getQuotationById);
router.post("/", createQuotation);
router.put("/:id", updateQuotation);
router.delete("/:id", deleteQuotation);
router.post("/:id/convert-to-invoice", convertQuotationToInvoice);

export default router;
