import { Router } from "express";
import { 
  getAllIncomes, 
  createIncome, 
  getAllExpenses, 
  createExpense,
  getIncomeCategories,
  getExpenseCategories,
  getServiceAgreements,
  getPayables,
  getReceivables,
  getPaymentOverviews,
  getExpensesIncomesBySource,
  getIncomeTableData,
  getExpenseTableData,
  getIncomeTransactionDetails,
  getExpenseTransactionDetails,
  payDebt,
  getMonthlyPaymentData,
  getYearlyPaymentData,
  getInvoiceInfo,
  getPaymentReport
} from "../controllers/transactioncontroller.js";

const router = Router();

router.get("/incomes", getAllIncomes);
router.post("/incomes", createIncome);
router.get("/incomes/categories", getIncomeCategories);
router.get("/expenses", getAllExpenses);
router.post("/expenses", createExpense);
router.get("/expenses/categories", getExpenseCategories);
router.get("/agreements", getServiceAgreements);

// Dashboard routes
router.get("/payables", getPayables);
router.get("/receivables", getReceivables);
router.get("/overviews", getPaymentOverviews);
router.get("/sources", getExpensesIncomesBySource);
router.get("/incomes-table", getIncomeTableData);
router.get("/expenses-table", getExpenseTableData);
router.get("/monthly-data", getMonthlyPaymentData);
router.get("/yearly-data", getYearlyPaymentData);
router.get("/invoice", getInvoiceInfo);
router.get("/report", getPaymentReport);

// Transaction details routes
router.get("/incomes/details/:clientId", getIncomeTransactionDetails);
router.get("/expenses/details/:agreementId", getExpenseTransactionDetails);
router.post("/pay-debt", payDebt);

export default router;
