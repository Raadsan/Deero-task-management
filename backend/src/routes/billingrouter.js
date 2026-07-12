import { Router } from "express";
import {
  getBillingReportData,
  getClientPaymentSummary,
  getInstallments,
  recordInstallmentPayment,
} from "../controllers/billingcontroller.js";

const router = Router();

router.get("/installments", getInstallments);
router.get("/installments/report", getBillingReportData);
router.get("/clients/:clientId/summary", getClientPaymentSummary);
router.post("/installments/:id/record-payment", recordInstallmentPayment);

export default router;
