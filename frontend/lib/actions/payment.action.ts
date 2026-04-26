"use server";

import { MONTH_NAMES, ROUTES } from "../constants";

import {
  Expense as ExpenseModel,
  ExpenseTransaction,
  Income as IncomeModel,
  IncomeServiceAgreement,
  IncomeTransaction,
} from "../generated/prisma";

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

import { prisma } from "@/prisma/prisma";
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

export async function getMonthlyPaymentData({
  startDate,
  endDate,
}: DateFilter): Promise<ActionResponse<PaymentMonthlyType[]>> {
  try {
    const fromDate = validateDate(new Date(startDate));
    const toDate = validateDate(new Date(endDate));
    const conditions = {
      createdAt: {
        gte: fromDate,
        lte: toDate,
      },
    };

    const [incomes, expenses] = await prisma.$transaction([
      prisma.incomeTransaction.findMany({
        where: {
          AND: conditions,
          status: "Paid",
        },
        select: {
          createdAt: true,
          subTotal: true,
          amountPaid: true,
        },
      }),
      prisma.expenseTransaction.findMany({
        where: {
          AND: conditions,
          status: "Paid",
        },
        select: {
          createdAt: true,
          totalAmount: true,
          amountPaid: true,
        },
      }),
    ]);

    if (!incomes.length && !expenses.length) return { success: true, data: [] };

    const monthlyData = Array(12)
      .fill(0)
      .map((_, index) => ({
        month: MONTH_NAMES[index],
        income: 0,
        expense: 0,
      }));

    if (incomes.length)
      incomes?.forEach((item) => {
        const monthIndex = new Date(item.createdAt as Date).getMonth();

        monthlyData[monthIndex].income += item.subTotal!;
      });

    if (expenses.length)
      expenses?.forEach((item) => {
        const monthIndex = new Date(item.createdAt as Date).getMonth();
        monthlyData[monthIndex].expense += item.totalAmount!;
      });

    const finalResult = monthlyData;

    return { success: true, data: finalResult };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getYearlyPaymentData(): Promise<
  ActionResponse<PaymentYearlyType[]>
> {
  try {
    const [weeklyIncomes, weeklyExpenses] = await prisma.$transaction([
      prisma.incomeTransaction.findMany({
        where: {
          status: "Paid",
        },
        select: {
          createdAt: true,
          subTotal: true,
          amountPaid: true,
        },
      }),

      prisma.expenseTransaction.findMany({
        where: {
          status: "Paid",
        },
        select: {
          createdAt: true,
          totalAmount: true,
          amountPaid: true,
        },
      }),
    ]);

    // loop through incomes and groub by year.
    const incomeGroupedByYear = weeklyIncomes.reduce(
      (acc: Record<number, typeof weeklyIncomes>, item) => {
        const year = new Date(item.createdAt!).getFullYear();
        if (!acc[year]) {
          acc[year] = [];
        }

        acc[year].push(item);
        return acc;
      },
      {},
    );

    // go through expenses and group by a year.
    const expenseGroupedByYear = weeklyExpenses.reduce(
      (acc: Record<number, typeof weeklyExpenses>, item) => {
        const year = new Date(item.createdAt!).getFullYear();
        if (!acc[year]) {
          acc[year] = [];
        }

        acc[year].push(item);
        return acc;
      },
      {},
    );

    //create map to group incomes and expenses.
    const yearlyData = new Map<string, PaymentYearlyType>();

    // go through goruped expensa nd then push to the yearlData object.
    Object.entries(expenseGroupedByYear).forEach(([year, income]) => {
      const typedIncome = income as typeof weeklyExpenses;
      const expenseAmount = typedIncome.reduce((acc, { totalAmount }) => {
        return acc + totalAmount!;
      }, 0);

      // we  have  the yar as key then only change expense value.
      if (yearlyData.has(year)) {
        yearlyData.get(year)!.expense = expenseAmount;
      }
      // otheriwse create with income as 0 we will be changing down bottom
      else {
        yearlyData.set(year, { year, income: 0, expense: expenseAmount });
      }
    });

    // here same opeartion but for incomes.
    Object.entries(incomeGroupedByYear).forEach(([year, transactions]) => {
      const typedTransactions = transactions as typeof weeklyIncomes;
      const incomeAmount = typedTransactions.reduce((acc, { subTotal }) => {
        return acc + subTotal!;
      }, 0);

      if (yearlyData.has(year)) {
        yearlyData.get(year)!.income = incomeAmount;
      } else {
        yearlyData.set(year, { year, income: incomeAmount, expense: 0 });
      }
    });

    // Create an array of years, starting from current year and descending as far as data exists,
    // then fill with next remaining years ahead if less than 10.
    const allYearsSet = new Set<number>();
    for (const k of yearlyData.keys()) {
      allYearsSet.add(Number(k));
    }
    const minYear = allYearsSet.size
      ? Math.min(...Array.from(allYearsSet))
      : new Date().getFullYear();

    let years: string[] = [];
    const currentYear = new Date().getFullYear();
    // First: take years from currentYear moving back until minYear or up to 10
    for (let year = currentYear; year >= minYear && years.length < 10; year--) {
      years.push(year.toString());
    }

    let nextYear = currentYear + 1;
    while (years.length < 10) {
      years.push(nextYear.toString());
      nextYear++;
    }

    // Map existing data into an object for year lookup
    const yearlyDataObj: Record<string, PaymentYearlyType> = {};
    for (const entry of yearlyData.values()) {
      yearlyDataObj[entry.year] = entry;
    }

    // Prepare the result array in order for the last 10 years (current year descending then fills forward)
    const result: PaymentYearlyType[] = years.map((year) => {
      if (yearlyDataObj[year]) {
        return {
          year,
          income: yearlyDataObj[year]?.income ?? 0,
          expense: yearlyDataObj[year]?.expense ?? 0,
        };
      }
      return { year, income: 0, expense: 0 };
    });

    return {
      success: true,
      data: result,
    };
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
    await prisma.incomeTransaction.delete({
      where: {
        id: transactionId,
      },
    });
    return { success: true };
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

    const {
      createdAt,
      totalAmount,
      amountPaid,
      method,
      status,
      tax,
      recieceverId,
      duetoDate,
      taxtType,
    } = params;

    await prisma.$transaction(
      async (customPrisma) => {
        const salaryTrasaction = await customPrisma.userSalary.create({
          data: {
            tax,
            method,
            status,
            dueToDate: duetoDate,
            totalAmount: parseFloat(totalAmount),
            recieverId: recieceverId,
            registeredBy: userSession?.user.id!,
            taxType: taxtType ?? "",
          },
        });

        await customPrisma.userSalaryDetails.create({
          data: {
            paidAmount: parseFloat(amountPaid),
            createdAt: createdAt ?? new Date(),
            salaryId: salaryTrasaction.id,
          },
        });
      },
      {
        timeout: 5000,
      },
    );

    return { success: true };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getUserSalaryDetails(
  userId: string,
): Promise<ActionResponse<UserSalaryDetailsType[]>> {
  try {
    const result = await prisma.userSalary.findMany({
      where: {
        recieverId: userId,
      },
      include: {
        UserSalaryDetails: {},
        recieverUser: {
          select: {
            name: true,
          },
        },
        registeredUser: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!result) return { success: true, data: undefined };
    const transformed: UserSalaryDetailsType[] = result.map((result) => {
      return {
        salaryId: result.id,
        createdAt: formatDate(result.createdAt ?? ""),
        dueToDate: formatDate(result.dueToDate ?? ""),
        totalAmount: result.totalAmount,
        tax: result.tax,
        status: result.status,
        method: result.method,
        notes: result?.notes ?? "",
        taxType: result.taxType,
        recieverName: result.recieverUser.name,
        registeredBy: result.registeredUser.name,
        detials: result.UserSalaryDetails.map((each) => {
          return {
            id: each.id,
            paidAt: formatDate(each.createdAt ?? ""),
            paidAmount: each.paidAmount,
          };
        }),
      };
    });
    return { success: true, data: transformed };
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

export async function getInvoiceInfo({
  type,
  transactionId,
  detailsId,
}: {
  type: "income" | "expense";
  transactionId: string;
  detailsId: string;
  createdAt: string;
}): Promise<ActionResponse<InvoiceType>> {
  try {
    if (type === "income") {
      const [incomeTransaction, details, allDetails] =
        await prisma.$transaction([
          prisma.incomeTransaction.findUnique({
            where: {
              id: transactionId,
            },
            include: {
              serviceAgreement: {
                select: {
                  description: true,
                  service: {
                    select: {
                      serviceName: true,
                    },
                  },
                  subService: {
                    select: {
                      name: true,
                    },
                  },
                  client: {
                    select: {
                      institution: true,
                      phone: true,
                      email: true,
                    },
                  },
                },
              },
            },
          }),
          prisma.incomeTransactionDetails.findUnique({
            where: {
              id: detailsId,
            },
          }),
          prisma.incomeTransactionDetails.findMany({
            where: {
              incomeTransactionId: transactionId,
            },
          }),
        ]);

      const detailsSum = allDetails.reduce((prev, current) => {
        return prev + current.paidAmount;
      }, 0);

      const discount = incomeTransaction?.discount || "0";
      const totalAmount = incomeTransaction?.totalAmount || 0;
      const totalAmountAfterDiscount = totalAmount * parseFloat(discount);
      const subTotalAfterDiscount = totalAmount - totalAmountAfterDiscount;
      const pending = (incomeTransaction?.subTotal || 0) - detailsSum;
      return {
        success: true,

        data: {
          description: incomeTransaction?.serviceAgreement.description ?? "",
          headerInfo: {
            createdAt: formatDate(details?.createdAt ?? "") ?? "",
            duetoDate: formatDate(incomeTransaction?.duetoDate ?? "") ?? "",
            id: incomeTransaction?.id!,
            clientName: incomeTransaction?.serviceAgreement.client.institution!,
            phone: incomeTransaction?.serviceAgreement.client.phone!,
            email: incomeTransaction?.serviceAgreement.client.email!,
            subTotal: incomeTransaction?.subTotal!,
          },

          items: [
            {
              service: incomeTransaction?.serviceAgreement.service.serviceName,
              package: incomeTransaction?.serviceAgreement.subService.name,
              "Paid at": formatDate(details?.createdAt ?? "") ?? "",
              "Total Amount": `$ ${incomeTransaction?.totalAmount}`,
              Discount: `${incomeTransaction?.discount} that is $${subTotalAfterDiscount}`,
              Tax: `${incomeTransaction?.taxValue} | ${incomeTransaction?.taxType}`,
              Subtotal: `$${incomeTransaction?.subTotal}`,
              "Current Amount": `$${details?.paidAmount}`,
              "Current Pending Amount": `$ ${pending.toFixed(2)}`,
            },
          ],
        },
      };
    } else if (type === "expense") {
      const [expenseTransaction, details, allDetails] =
        await prisma.$transaction([
          prisma.expenseTransaction.findUnique({
            where: {
              id: transactionId,
            },
            include: {
              expenseServiceAgreement: {
                select: {
                  description: true,
                },
              },
              expense: {
                select: {
                  expenseType: true,
                },
              },
            },
          }),
          prisma.expenseTransactionDetails.findUnique({
            where: {
              id: detailsId,
            },
          }),
          prisma.expenseTransactionDetails.findMany({
            where: {
              expenseTransactionId: transactionId,
            },
          }),
        ]);

      const detailsSum = allDetails.reduce((prev, current) => {
        return prev + current.paidAmount;
      }, 0);

      const totalAmount = expenseTransaction?.totalAmount || 0;
      const pending = totalAmount - detailsSum;
      return {
        success: true,
        data: {
          description:
            expenseTransaction?.expenseServiceAgreement.description ?? "",
          headerInfo: {
            createdAt: formatDate(details?.createdAt ?? "") ?? "",
            duetoDate: formatDate(expenseTransaction?.duetoDate ?? "") ?? "",
            id: expenseTransaction?.id!,
            clientName: "",
            phone: "",
            email: "",
            subTotal: totalAmount,
          },

          items: [
            {
              "Expense Type": expenseTransaction?.expense.expenseType,
              "Total Amount": `$ ${totalAmount}`,
              "Current Amount": `$${details?.paidAmount}`,
              "Pending Amount": `$${pending.toFixed(2)}`,
              "Paid at": formatDate(details?.createdAt ?? "") ?? "",
            },
          ],
        },
      };
    } else {
      return {
        success: true,
        data: {
          description: "",
          headerInfo: undefined,
          items: [],
        },
      };
    }
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getPaymentReport({
  fromMonth,
  toMonth,
  type,
}: {
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
    let from = undefined;
    let to = undefined;
    if (fromMonth) {
      from = validateDate(fromMonth);
    }
    if (toMonth) {
      to = validateDate(toMonth);
    }
    const filterConditions = {
      createdAt: {
        gte: from,
        lte: to,
      },
    };
    const dateDescription = getFromToDateDescription({
      fromDate: from,
      toDate: to,
    });
    if (type === "income") {
      const incomes = await prisma.incomeTransaction.findMany({
        where: {
          status: "Paid",
          AND: filterConditions,
        },
        include: {
          income: {
            select: {
              incomeType: true,
            },
          },
        },
      });

      const groupedByServices = new Map<string, Array<ReportType>>();
      incomes.map((eachIncome) => {
        const incomeSourceTypeId = eachIncome.incomeCategoryId!;

        const item: ReportType = {
          Date: dateDescription ?? "ALl Dates",
          Amount: `${eachIncome.subTotal}`,
          "Paid By": "coming.....",
          incomeType: eachIncome.income?.incomeType ?? "",
        };

        if (groupedByServices.get(incomeSourceTypeId)) {
          const arr = groupedByServices.get(incomeSourceTypeId)!;
          if (arr.length > 0) {
            arr[0].Amount = `${parseFloat(arr[0].Amount) + (eachIncome.subTotal || 0)}`;
          } else {
            arr.push(item);
          }
          return;
        }
        groupedByServices.set(incomeSourceTypeId, [item]);
      });
      const flatElements = Array.from(groupedByServices.values()).flat();

      return {
        success: true,
        data: {
          items: flatElements,
          total: flatElements
            .reduce((prev, current) => {
              return prev + parseFloat(current.Amount);
            }, 0)
            .toFixed(3),
        },
      };
    } else if (type === "expense") {
      const [expenses, salaries] = await prisma.$transaction([
        prisma.expenseTransaction.findMany({
          where: {
            AND: filterConditions,
            status: "Paid",
          },
          include: {
            expense: {
              select: {
                expenseType: true,
              },
            },
          },
        }),
        prisma.userSalary.findMany({
          where: {
            AND: filterConditions,
            status: "Paid",
          },
        }),
      ]);

      const groupedByExpenes = new Map<string, Array<ReportType>>();
      expenses.map((eachExpense) => {
        const expenseId = eachExpense.expenseCategoryId;
        const item: ReportType = {
          Date: dateDescription ?? "All Dates",
          Amount: String(eachExpense.totalAmount),
          "Expense Type": eachExpense.expense.expenseType,
        };

        if (groupedByExpenes.get(expenseId)) {
          const array = groupedByExpenes.get(expenseId);
          if (array?.length && array.length > 0) {
            array[0].Amount += eachExpense.totalAmount;
          } else {
            array?.push(item);
          }
          return;
        }
        groupedByExpenes.set(expenseId, [item]);
      });

      const flatElements = Array.from(groupedByExpenes.values()).flat();
      if (salaries.length > 0) {
        flatElements.push({
          Date: dateDescription ?? "All Dates",
          Amount: salaries
            .reduce((prev, current) => {
              return prev + current.totalAmount;
            }, 0)
            .toFixed(3),
          "Expense Type": "Staff Salaries",
        });
      }
      return {
        success: true,
        data: {
          items: flatElements,
          total: flatElements
            .reduce((prev, current) => {
              return prev + parseFloat(current.Amount);
            }, 0)
            .toFixed(3),
        },
      };
    }

    return {
      success: true,
      data: {
        total: "",
        items: [],
      },
    };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}

export async function getUserSalaryReport({
  fromMonth,
  toMonth,
}: {
  fromMonth?: Date;
  toMonth?: Date;
}): Promise<ActionResponse<UserSalaryReport[]>> {
  try {
    let from = undefined;
    let to = undefined;
    if (fromMonth) {
      from = validateDate(fromMonth);
    }
    if (toMonth) {
      to = validateDate(toMonth);
    }
    const filterConditions = {
      createdAt: {
        gte: from,
        lte: to,
      },
    };

    let dateDescription = undefined;
    const formatFrom = formatDate(fromMonth ?? "");
    const formatToDate = formatDate(toMonth ?? "");
    if (from && to) {
      dateDescription = `From ${formatFrom} to  ${formatToDate}`;
    } else if (from) {
      dateDescription = `From ${formatFrom} to Today `;
    } else if (to) {
      dateDescription = `From very beggining to  ${formatToDate}`;
    }
    const userSalaries = await prisma.userSalary.findMany({
      where: {
        AND: filterConditions,
        status: "Paid",
      },
      include: {
        recieverUser: {
          select: {
            name: true,
          },
        },
        UserSalaryDetails: {},
      },
    });

    if (userSalaries.length < 0) return { success: true, data: [] };

    const groubyRecieverId = Object.groupBy(
      userSalaries,
      (eachUserSalary: any) => eachUserSalary.recieverId,
    );
    const transformed = Object.entries(groubyRecieverId).map(([key, value]) => {
      const typedValue = value as typeof userSalaries;
      return {
        paidAt: dateDescription ?? "All Dates",
        name: typedValue?.at(0)?.recieverUser.name ?? "",
        baseSalary: String(typedValue?.at(0)?.totalAmount) ?? "",
        total:
          typedValue
            ?.reduce((prev, current) => {
              return prev + current.totalAmount;
            }, 0)
            .toFixed(3) ?? "",
      };
    });

    return { success: true, data: transformed };
  } catch (error) {
    return handleError({ errors: error, type: "server" }) as ErrorResponse;
  }
}
