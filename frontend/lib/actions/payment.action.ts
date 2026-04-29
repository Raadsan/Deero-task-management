"use server";

import { MONTH_NAMES, ROUTES } from "../constants";

import {
  Expense as ExpenseModel,
  Income as IncomeModel,
  IncomeTransaction,
  TaskStatus,
} from "../schema";

import {
  ActionResponse,
  DateFilter,
  ErrorResponse,
  ExpenseIncomeSourceType,
  ExpenseTransactionDetialsTye,
  IncomeTransactionDetialsTye,
  InvoiceType,
  PayableType,
  PaymentMonthlyType,
  PaymentSummaryType,
  PaymentYearlyType,
  RecievableType,
  ReportType,
  TableExpense,
  TableIncome,
  UserSalaryDetailsType,
  UserSalaryReport,
} from "../types";
import { formatDate, getFromToDateDescription, validateDate } from "../utils";

// Direct prisma access removed from frontend
// import { prisma } from "@/prisma/prisma";
import { revalidatePath } from "next/cache";
import z from "zod";
import { handleError } from "../error/handle-error";
import { SalarySchema } from "../validations";
import { getUserSession } from "./auth.action";
import { generateCustomId } from "./shared.action";
import api from "../api";

export async function createIncomeTransaction(params: any): Promise<ActionResponse> {
  try {
    const { data: session } = await getUserSession();
    const response = await api.post("/api/transactions/incomes", {
      ...params,
      userId: session?.user.id,
    });
    if (response.data.success) {
      revalidatePath(ROUTES.payments);
      return { success: true };
    }
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function createExpenseTransaction(params: any): Promise<ActionResponse> {
  try {
    const { data: session } = await getUserSession();
    const response = await api.post("/api/transactions/expenses", {
      ...params,
      userId: session?.user.id,
    });
    if (response.data.success) {
      revalidatePath(ROUTES.payments);
      return { success: true };
    }
    return { success: false, errors: { message: response.data.error } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getAllExpenses(): Promise<ActionResponse<any[]>> {
  try {
    const response = await api.get("/api/transactions/expenses/categories");
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: "Failed to fetch expenses" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getAllIncomes(): Promise<ActionResponse<any[]>> {
  try {
    const response = await api.get("/api/transactions/incomes/categories");
    if (response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, errors: { message: "Failed to fetch incomes" } };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getServiceAgreements(params: {
  clientId: string;
  serviceId: string;
  subServiceId: string;
}): Promise<ActionResponse<any[]>> {
  try {
    const { clientId, serviceId, subServiceId } = params;
    if (clientId && serviceId && subServiceId) {
      const response = await api.get("/api/transactions/agreements", {
        params: { clientId, serviceId, subServiceId },
      });
      if (response.data.success) {
        return { success: true, data: response.data.data };
      }
    }
    return { success: true, data: [] };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getPayables(params: DateFilter): Promise<ActionResponse<PayableType[]>> {
  try {
    const response = await api.get("/api/transactions/payables", { params });
    return response.data;
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}
export async function getRecievables(params: DateFilter): Promise<ActionResponse<RecievableType[]>> {
  try {
    const response = await api.get("/api/transactions/receivables", { params });
    return response.data;
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getPaymentOverviews(params: DateFilter): Promise<ActionResponse<PaymentSummaryType>> {
  try {
    const response = await api.get("/api/transactions/overviews", { params });
    return response.data;
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getMonthlyPaymentData(params: DateFilter): Promise<ActionResponse<PaymentMonthlyType[]>> {
  try {
    const response = await api.get("/api/transactions/monthly-data", { params });
    return response.data;
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getYearlyPaymentData(): Promise<ActionResponse<PaymentYearlyType[]>> {
  try {
    const response = await api.get("/api/transactions/yearly-data");
    return response.data;
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}



export async function getIncomeTransactonDetails(
  clientId: string,
): Promise<ActionResponse<IncomeTransactionDetialsTye>> {
  try {
    const response = await api.get(`/api/transactions/incomes/details/${clientId}`);
    if (!response.data.success) {
      return { success: false, errors: response.data.error };
    }
    const details = response.data.data;
    
    if (!details || details.length === 0) {
       return { success: true, data: { clientName: "", source: "", totalDept: 0, services: [] } };
    }

    let categoryDept = 0;
    const groupedServices = new Map();

    details.forEach((eachOne) => {
      eachOne.incomeTransaction.forEach((each) => {
        const serviceId = each.serviceAgreement.service.id;
        const serviceName = each.serviceAgreement.service.serviceName;

        let currentChunkDept = each.transactionDetails.reduce((prev, current) => prev + current.paidAmount, 0);
        currentChunkDept = (each.subTotal ?? 0) - currentChunkDept;

        const newSubCategory = {
          categoryId: each.serviceAgreement.subService.categoryId,
          name: each.serviceAgreement.subService.name,
          createdAt: formatDate(each.createdAt ?? ""),
          totalAmount: each.totalAmount,
          status: each.status,
          method: each.method,
          amountPaid: each.amountPaid,
          discount: each.discount,
          taxValue: each.taxValue,
          taxType: each.taxType,
          subTotal: each.subTotal,
          dueToDate: formatDate(each.duetoDate ?? ""),
          transactions: each.transactionDetails.map((eachDetail) => ({
            id: eachDetail.id,
            incomeTransactionId: eachDetail.incomeTransactionId,
            paidAgain: formatDate(eachDetail.createdAt ?? ""),
            paidAmount: eachDetail.paidAmount,
          })),
        };
        categoryDept += currentChunkDept;

        if (groupedServices.has(serviceId)) {
          const existingService = groupedServices.get(serviceId);
          existingService.categoryTotalDept += currentChunkDept;
          existingService.subCategories.push(newSubCategory);
        } else {
          groupedServices.set(serviceId, {
            category: serviceName,
            id: serviceId,
            categoryTotalDept: currentChunkDept,
            subCategories: [newSubCategory],
          });
        }
      });
    });

    const transformedDetails: IncomeTransactionDetialsTye = {
      clientName: details[0]?.client.institution,
      source: details[0]?.client.source,
      totalDept: categoryDept,
      services: Array.from(groupedServices.values()),
    };
    return { success: true, data: transformedDetails };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

// this delete both income and expense transctions
export async function deleteTransaction({
  transactionId,
}: {
  transactionId: string;
}): Promise<ActionResponse> {
  try {
    const response = await api.delete(`/api/transactions/${transactionId}`);
    return response.data;
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}



export async function payIncomeExpenseDept(params: {
  currentAmount: string;
  transactionId: string;
  paramsId: string;
  isFullyPaid: boolean;
  type: "income" | "expense" | "salary";
}): Promise<ActionResponse> {
  try {
    const response = await api.post("/api/transactions/pay-debt", params);
    if (!response.data.success) {
      return { success: false, errors: response.data.error };
    }

    if (params.type !== "salary") {
      revalidatePath(
        ROUTES.transactionDetails(String(params.paramsId), params.type),
      );
    }

    return { success: true };
  } catch (error) {
    return handleError({
      type: "server",
      errors: error,
    }) as ErrorResponse;
  }
}

export async function getExpenseTransactionDetials({
  agreementId,
}: {
  agreementId: string;
}): Promise<ActionResponse<ExpenseTransactionDetialsTye>> {
  try {
    const response = await api.get(`/api/transactions/expenses/details/${agreementId}`);
    if (!response.data.success) {
      return { success: false, errors: response.data.error };
    }
    const agreement = response.data.data;

    const sumSubTransactions =
      agreement?.expenseTransaction[0].expenseTransactionDetails.reduce(
        (prev, current) => {
          return prev + current.paidAmount;
        },
        0,
      );
    const totaldept = agreement?.base! - sumSubTransactions!;
    const transformed: ExpenseTransactionDetialsTye = {
      paidAt: formatDate(agreement?.createdAt ?? ""),
      base: agreement?.base,
      id: agreement?.expenseTransaction[0].id!,
      expenseType: agreement?.expenseTransaction[0].expense.expenseType ?? "",
      registeredBy: agreement?.expenseTransaction[0].user.name ?? "",
      description: agreement?.description ?? "",
      totalDept: totaldept.toFixed(2),
      status: agreement?.expenseTransaction[0].status ?? "",
      method: agreement?.expenseTransaction[0].method ?? "",
      transactions:
        agreement?.expenseTransaction[0].expenseTransactionDetails.map(
          (each) => {
            return {
              id: each.id,
              transactionId: each.expenseTransactionId,
              paidAt: formatDate(each?.createdAt ?? ""),
              amount: each.paidAmount,
            };
          },
        ) ?? [],
    };

    return { success: true, data: transformed };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function payUserSalary(
  params: z.infer<typeof SalarySchema> & {
    recieceverId: string;
  },
): Promise<ActionResponse> {
  try {
    const { data: userSession } = await getUserSession();
    const response = await api.post("/api/salary/pay", {
      ...params,
      registeredById: userSession?.user.id,
    });
    return response.data;
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getUserSalaryDetails(
  userId: string,
): Promise<ActionResponse<UserSalaryDetailsType[]>> {
  try {
    const response = await api.get(`/api/salary/user/${userId}`);
    return response.data;
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getExpensesIncomesBySource(params: DateFilter): Promise<
  ActionResponse<{
    expenses: ExpenseIncomeSourceType[];
    incomes: ExpenseIncomeSourceType[];
  }>
> {
  try {
    const response = await api.get("/api/transactions/sources", { params });
    return response.data;
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getIncomeTableData(params: DateFilter): Promise<ActionResponse<TableIncome[]>> {
  try {
    const response = await api.get("/api/transactions/incomes-table", { params });
    return response.data;
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getExpenseTableData(params: DateFilter): Promise<ActionResponse<TableExpense[]>> {
  try {
    const response = await api.get("/api/transactions/expenses-table", { params });
    return response.data;
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getInvoiceInfo(params: {
  type: "income" | "expense";
  transactionId: string;
  detailsId: string;
  createdAt: string;
}): Promise<ActionResponse<InvoiceType>> {
  try {
    const response = await api.get("/api/transactions/invoice", { params });
    return response.data;
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getPaymentReport(params: {
  fromMonth?: Date;
  toMonth?: Date;
  type: "income" | "expense";
}): Promise<
  ActionResponse<{
    total: string;
    items: ReportType[];
  }>
> {
  try {
    const response = await api.get("/api/transactions/report", { params });
    return response.data;
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getUserSalaryReport(params: {
  fromMonth?: Date;
  toMonth?: Date;
}): Promise<ActionResponse<UserSalaryReport[]>> {
  try {
    const response = await api.get("/api/salary/report", { params });
    return response.data;
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}
