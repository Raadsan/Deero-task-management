import { prisma } from "../lib/prisma.js";
import { generateCustomId } from "../lib/id-generator.js";

export const getAllIncomes = async (req, res) => {
  try {
    const incomes = await prisma.incomeTransaction.findMany({
      include: { user: true, income: true, serviceAgreement: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: incomes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getAllExpenses = async (req, res) => {
  try {
    const expenses = await prisma.expenseTransaction.findMany({
      include: { user: true, expense: true, expenseServiceAgreement: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: expenses });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createIncome = async (req, res) => {
  const data = req.body;
  console.log("--- CREATE INCOME START ---");
  console.log("Data received:", JSON.stringify(data, null, 2));
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      console.log("Transaction started...");
      
      // 1. Find or create Income Category
      const catName = data.incomeCategoryName || data.incomeType;
      console.log("Looking for category:", catName);
      
      let incomeCategory = await tx.income.findFirst({
        where: { incomeType: catName }
      });

      if (!incomeCategory) {
        console.log("Category not found, generating ID...");
        const catId = await generateCustomId({ entityTybe: "payments", prisma: tx });
        console.log("Generated Category ID:", catId);
        incomeCategory = await tx.income.create({
          data: {
            id: catId,
            incomeType: catName
          }
        });
        console.log("Category created successfully.");
      } else {
        console.log("Category found:", incomeCategory.id);
      }

      // 2. Generate Transaction ID
      console.log("Generating Transaction ID...");
      const transactionId = await generateCustomId({ entityTybe: "payments", prisma: tx });
      console.log("Generated Transaction ID:", transactionId);

      // 3. Create Income Transaction
      console.log("Creating Income Transaction...");
      const incomeData = {
        id: transactionId,
        userId: data.userId,
        incomeCategoryId: incomeCategory.id,
        agreementId: data.agreementId || data.agreement,
        amountPaid: Number(data.amountPaid),
        totalAmount: Number(data.totalAmount),
        discount: String(data.discount),
        subTotal: Number(data.subTotal),
        status: data.status,
        method: data.method,
        taxType: data.taxType,
        taxValue: Number(data.taxValue),
        notes: data.notes || "",
        duetoDate: data.duetoDate ? new Date(data.duetoDate) : null,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      };
      console.log("Income Data to save:", JSON.stringify(incomeData, null, 2));

      const income = await tx.incomeTransaction.create({
        data: incomeData,
      });
      console.log("Income Transaction created successfully.");

      // Temporarily commented out for debugging
      /*
      console.log("Creating Transaction Details...");
      await tx.incomeTransactionDetails.create({
        data: {
          incomeTransactionId: income.id,
          paidAmount: Number(data.amountPaid),
        }
      });
      console.log("Transaction Details created successfully.");
      */

      return income;
    });

    console.log("--- CREATE INCOME SUCCESS ---");
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error("!!! CREATE INCOME ERROR !!!");
    console.error("Error Message:", error.message);
    console.error("Error Stack:", error.stack);
    res.status(500).json({ success: false, error: error.message });
  }
};



export const createExpense = async (req, res) => {
  const data = req.body;
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Find or create Expense Category
      let expenseCategory = await tx.expense.findFirst({
        where: { expenseType: data.expenseCategoryName || data.expenseType }
      });

      if (!expenseCategory) {
        const catId = await generateCustomId({ entityTybe: "payments", prisma: tx });
        expenseCategory = await tx.expense.create({
          data: {
            id: catId.data || catId,
            expenseType: data.expenseCategoryName || data.expenseType
          }
        });
      }

      // 2. Create Expense Service Agreement (New expense usually creates an agreement)
      const agreementId = await generateCustomId({ entityTybe: "payments", prisma: tx });
      const agreement = await tx.expenseServiceAgreement.create({
        data: {
          id: agreementId.data || agreementId,
          base: Number(data.totalAmount),
          description: data.notes || "",
        }
      });

      // 3. Generate Transaction ID
      const transactionId = await generateCustomId({ entityTybe: "payments", prisma: tx });

      // 4. Create Expense Transaction
      const expense = await tx.expenseTransaction.create({
        data: {
          id: transactionId.data || transactionId,
          userId: data.userId,
          expenseCategoryId: expenseCategory.id,
          expneseAgreementId: agreement.id,
          amountPaid: Number(data.amountPaid),
          totalAmount: Number(data.totalAmount),
          status: data.status,
          method: data.method,
          notes: data.notes || "",
          duetoDate: data.duetoDate ? new Date(data.duetoDate) : null,
          createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        },
      });

      // 5. Create Transaction Details
      await tx.expenseTransactionDetails.create({
        data: {
          expenseTransactionId: expense.id,
          paidAmount: Number(data.amountPaid),
        }
      });

      return expense;
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error("Create Expense Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getIncomeCategories = async (req, res) => {
  try {
    const categories = await prisma.income.findMany({});
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getExpenseCategories = async (req, res) => {
  try {
    const categories = await prisma.expense.findMany({});
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getServiceAgreements = async (req, res) => {
  const { clientId, serviceId, subServiceId } = req.query;
  try {
    const agreements = await prisma.incomeServiceAgreement.findMany({
      where: {
        clientId,
        serviceId,
        subServiceId,
      },
      include: {
        incomeTransaction: true,
      },
    });

    const filtered = agreements.filter(a => a.incomeTransaction.length === 0);
    res.json({ success: true, data: filtered });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Dashboard functions
export const getPayables = async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    const fromDate = startDate ? new Date(startDate) : undefined;
    const toDate = endDate ? new Date(endDate) : undefined;
    const filterConditions = {
      createdAt: { gte: fromDate, lte: toDate },
    };

    const payables = await prisma.expenseTransaction.findMany({
      where: {
        AND: filterConditions,
        OR: [{ status: "Partially Paid" }, { status: "Unpaid(Payable)" }],
      },
      select: {
        duetoDate: true, status: true, amountPaid: true, totalAmount: true,
        expenseTransactionDetails: {},
        expense: { select: { expenseType: true } },
      },
    });

    const data = payables.map((each) => {
      const isParpialllyPiad = each.status === "Partially Paid";
      const remaining = each.expenseTransactionDetails.reduce((prev, current) => prev + current.paidAmount, 0);
      return {
        ...each,
        expenseType: each.expense?.expenseType,
        amount: isParpialllyPiad ? each.totalAmount - remaining : each.totalAmount,
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getReceivables = async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    const fromDate = startDate ? new Date(startDate) : undefined;
    const toDate = endDate ? new Date(endDate) : undefined;
    const filterConditions = {
      createdAt: { gte: fromDate, lte: toDate },
    };

    const receivables = await prisma.incomeTransaction.findMany({
      where: {
        AND: filterConditions,
        OR: [{ status: "Partially Paid" }, { status: "Unpaid(Recievable)" }],
      },
      select: {
        duetoDate: true, status: true, amountPaid: true, subTotal: true,
        serviceAgreement: { select: { client: { select: { institution: true } } } },
      },
    });

    const data = receivables.map((each) => {
      const isParpialllyPiad = each.status === "Partially Paid";
      return {
        ...each,
        amount: isParpialllyPiad ? each.subTotal - each.amountPaid : each.subTotal,
        client: each.serviceAgreement.client.institution,
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getPaymentOverviews = async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    const fromDate = startDate ? new Date(startDate) : undefined;
    const toDate = endDate ? new Date(endDate) : undefined;
    const filterConditions = { createdAt: { gte: fromDate, lte: toDate } };

    const [
      paidIncome, paritallyPaidIncome, unPaidIncome,
      paidExpense, partiallyPaidExpense, unPaidExpense,
      paidIncomeByCash, partialPaidIncomeByCash,
      paidExpenseByCash, partialPaidExpenseByCash,
      paidExpenseByOneline, partialPaidExpenseByOnline,
      paidIncomeByOneline, partialPaidIncomeByOnline,
      userSalaryDetails,
    ] = await prisma.$transaction([
      prisma.incomeTransaction.aggregate({ _sum: { subTotal: true }, where: { status: "Paid", AND: filterConditions } }),
      prisma.incomeTransaction.aggregate({ _sum: { amountPaid: true, subTotal: true }, where: { status: "Partially Paid", AND: filterConditions } }),
      prisma.incomeTransaction.aggregate({ _sum: { subTotal: true }, where: { status: "Unpaid(Recievable)", AND: filterConditions } }),
      prisma.expenseTransaction.aggregate({ _sum: { totalAmount: true }, where: { status: "Paid", AND: filterConditions } }),
      prisma.expenseTransaction.aggregate({ _sum: { amountPaid: true, totalAmount: true }, where: { status: "Partially Paid", AND: filterConditions } }),
      prisma.expenseTransaction.aggregate({ _sum: { totalAmount: true }, where: { status: "Unpaid(Payable)", AND: filterConditions } }),
      prisma.incomeTransaction.aggregate({ _sum: { subTotal: true }, where: { method: "Cash", status: "Paid", AND: filterConditions } }),
      prisma.incomeTransaction.aggregate({ _sum: { amountPaid: true }, where: { method: "Cash", status: "Partially Paid", AND: filterConditions } }),
      prisma.expenseTransaction.aggregate({ _sum: { totalAmount: true }, where: { method: "Cash", status: "Paid", AND: filterConditions } }),
      prisma.expenseTransaction.aggregate({ _sum: { amountPaid: true }, where: { method: "Cash", status: "Partially Paid", AND: filterConditions } }),
      prisma.expenseTransaction.aggregate({ _sum: { totalAmount: true }, where: { method: { not: "Cash" }, status: "Paid", AND: filterConditions } }),
      prisma.expenseTransaction.aggregate({ _sum: { amountPaid: true }, where: { method: { not: "Cash" }, status: "Partially Paid", AND: filterConditions } }),
      prisma.incomeTransaction.aggregate({ _sum: { subTotal: true }, where: { method: { not: "Cash" }, status: "Paid", AND: filterConditions } }),
      prisma.incomeTransaction.aggregate({ _sum: { amountPaid: true }, where: { method: { not: "Cash" }, status: "Partially Paid", AND: filterConditions } }),
      prisma.userSalaryDetails.aggregate({ _sum: { paidAmount: true }, where: { createdAt: { gte: fromDate, lte: toDate } } }),
    ]);

    const totalIncome = (paidIncome._sum.subTotal || 0) + (paritallyPaidIncome._sum.amountPaid || 0);
    const totalExpense = (paidExpense._sum.totalAmount || 0) + (partiallyPaidExpense._sum.amountPaid || 0);
    const totalRecievable = (unPaidIncome._sum.subTotal || 0) + ((paritallyPaidIncome._sum.subTotal || 0) - (paritallyPaidIncome._sum.amountPaid || 0));
    const totalPayable = (unPaidExpense._sum.totalAmount || 0) + ((partiallyPaidExpense._sum.totalAmount || 0) - (partiallyPaidExpense._sum.amountPaid || 0));

    res.json({
      success: true,
      data: {
        totalIncome, totalExpense, totalRecievable, totalPayable,
        salaryExpense: userSalaryDetails._sum.paidAmount || 0,
        paidIncomeByCash: (paidIncomeByCash._sum.subTotal || 0) + (partialPaidIncomeByCash._sum.amountPaid || 0),
        paidExpenseByCash: (paidExpenseByCash._sum.totalAmount || 0) + (partialPaidExpenseByCash._sum.amountPaid || 0),
        paidExpenseByOneline: (paidExpenseByOneline._sum.totalAmount || 0) + (partialPaidExpenseByOnline._sum.amountPaid || 0),
        paidIncomeByOneline: (paidIncomeByOneline._sum.subTotal || 0) + (partialPaidIncomeByOnline._sum.amountPaid || 0),
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getExpensesIncomesBySource = async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    const fromDate = startDate ? new Date(startDate) : undefined;
    const toDate = endDate ? new Date(endDate) : undefined;
    const filterConditions = { createdAt: { gte: fromDate, lte: toDate } };

    const [allPaidExpense, allPaidIncomes] = await prisma.$transaction([
      prisma.expense.findMany({
        include: {
          expenseTransaction: {
            where: { status: "Paid", createdAt: { gte: fromDate, lte: toDate } },
            include: { expenseTransactionDetails: {} },
          },
        },
      }),
      prisma.income.findMany({
        include: {
          incomeTransaction: {
            where: { status: "Paid", createdAt: { gte: fromDate, lte: toDate } },
            include: { transactionDetails: {} },
          },
        },
      }),
    ]);

    const expensesTransformed = allPaidExpense.map((eachExpense, index) => {
      const totalValue = eachExpense.expenseTransaction.reduce((prev, current) => prev + current.totalAmount, 0);
      return { no: index + 1, key: eachExpense.expenseType, amount: totalValue };
    }).filter(f => f.amount !== 0);

    const incomeTransformed = allPaidIncomes.map((eachIncome, index) => {
      const totalValue = eachIncome.incomeTransaction.reduce((prev, current) => prev + (current?.subTotal ?? 0), 0);
      return { no: index + 1, key: eachIncome.incomeType, amount: totalValue };
    }).filter(f => f.amount !== 0);

    res.json({ success: true, data: { expenses: expensesTransformed, incomes: incomeTransformed } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getIncomeTableData = async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    const fromDate = startDate ? new Date(startDate) : undefined;
    const toDate = endDate ? new Date(endDate) : undefined;
    if (toDate) toDate.setHours(23, 59, 59, 59);
    const filterConditions = { createdAt: { gte: fromDate, lte: toDate } };

    const clients = await prisma.client.findMany({
      where: { AND: filterConditions },
      include: {
        serviceAgreements: {
          include: {
            incomeTransaction: { select: { user: { select: { name: true } } } },
          },
        },
      },
    });

    if (!clients.length) return res.json({ success: true, data: [] });

    const filterClients = clients.filter(each => 
      each.serviceAgreements.some(a => a.incomeTransaction.length > 0)
    );

    const transformedIncomes = filterClients.map(eachClient => {
      const firstAgreement = eachClient.serviceAgreements.find(a => a.incomeTransaction.length > 0);
      return {
        id: eachClient.id,
        source: eachClient.source,
        clientName: eachClient.institution,
        recievedBy: firstAgreement ? firstAgreement.incomeTransaction[0].user.name : "Unknown",
      };
    });

    res.json({ success: true, data: transformedIncomes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getExpenseTableData = async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    const fromDate = startDate ? new Date(startDate) : undefined;
    const toDate = endDate ? new Date(endDate) : undefined;
    if (toDate) toDate.setHours(23, 59, 59, 59);
    const filterConditions = { createdAt: { gte: fromDate, lte: toDate } };

    const expenses = await prisma.expenseServiceAgreement.findMany({
      where: { AND: filterConditions },
      include: {
        expenseTransaction: {
          include: {
            expense: { select: { expenseType: true } },
            user: { select: { name: true } },
          },
        },
      },
    });

    if (!expenses.length) return res.json({ success: true, data: [] });

    const transformedExpenses = expenses.map(eachExpense => ({
      id: eachExpense.id,
      base: eachExpense.base,
      registeredBy: eachExpense.expenseTransaction[0]?.user.name,
      createdAt: eachExpense.createdAt,
      expenseType: eachExpense.expenseTransaction[0]?.expense.expenseType,
      description: eachExpense.description.length < 1 ? "Not Provided" : eachExpense.description,
    }));

    res.json({ success: true, data: transformedExpenses });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getIncomeTransactionDetails = async (req, res) => {
  const { clientId } = req.params;
  try {
    const details = await prisma.incomeServiceAgreement.findMany({
      where: { clientId },
      select: {
        incomeTransaction: {
          include: {
            income: { select: { incomeType: true } },
            transactionDetails: {},
            serviceAgreement: {
              include: {
                subService: { select: { name: true, id: true, categoryId: true } },
                service: { select: { serviceName: true, id: true } },
              },
            },
          },
        },
        client: { select: { institution: true, source: true } },
      },
    });

    res.json({ success: true, data: details });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getExpenseTransactionDetails = async (req, res) => {
  const { agreementId } = req.params;
  try {
    const agreement = await prisma.expenseServiceAgreement.findFirst({
      where: { id: agreementId },
      include: {
        expenseTransaction: {
          include: {
            expenseTransactionDetails: {},
            user: { select: { name: true } },
            expense: { select: { expenseType: true } },
          },
        },
      },
    });

    res.json({ success: true, data: agreement });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const payDebt = async (req, res) => {
  const { currentAmount, transactionId, isFullyPaid, type } = req.body;
  try {
    await prisma.$transaction(async (tnx) => {
      if (type === "income") {
        await tnx.incomeTransactionDetails.create({
          data: {
            paidAmount: Number(currentAmount),
            incomeTransactionId: transactionId,
          },
        });
        if (isFullyPaid) {
          await tnx.incomeTransaction.update({
            where: { id: transactionId },
            data: { status: "Paid", duetoDate: null },
          });
        }
      } else if (type === "expense") {
        await tnx.expenseTransactionDetails.create({
          data: {
            paidAmount: Number.parseFloat(currentAmount),
            expenseTransactionId: transactionId,
          },
        });
        if (isFullyPaid) {
          await tnx.expenseTransaction.update({
            where: { id: transactionId },
            data: { status: "Paid", duetoDate: null },
          });
        }
      } else if (type === "salary") {
        await tnx.userSalaryDetails.create({
          data: {
            paidAmount: Number.parseFloat(currentAmount),
            salaryId: transactionId,
          },
        });
        if (isFullyPaid) {
          await tnx.userSalary.update({
            where: { id: transactionId },
            data: { status: "Paid", dueToDate: null },
          });
        }
      }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
export const getMonthlyPaymentData = async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    const fromDate = startDate ? new Date(startDate) : undefined;
    const toDate = endDate ? new Date(endDate) : undefined;
    const filterConditions = { createdAt: { gte: fromDate, lte: toDate } };

    const [incomes, expenses] = await prisma.$transaction([
      prisma.incomeTransaction.findMany({
        where: { AND: filterConditions, status: "Paid" },
        select: { createdAt: true, subTotal: true }
      }),
      prisma.expenseTransaction.findMany({
        where: { AND: filterConditions, status: "Paid" },
        select: { createdAt: true, totalAmount: true }
      })
    ]);

    const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyData = MONTH_NAMES.map(month => ({ month, income: 0, expense: 0 }));

    incomes.forEach(item => {
      const monthIndex = new Date(item.createdAt).getMonth();
      monthlyData[monthIndex].income += item.subTotal || 0;
    });

    expenses.forEach(item => {
      const monthIndex = new Date(item.createdAt).getMonth();
      monthlyData[monthIndex].expense += item.totalAmount || 0;
    });

    res.json({ success: true, data: monthlyData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getYearlyPaymentData = async (req, res) => {
  try {
    const [weeklyIncomes, weeklyExpenses] = await prisma.$transaction([
      prisma.incomeTransaction.findMany({ where: { status: "Paid" }, select: { createdAt: true, subTotal: true } }),
      prisma.expenseTransaction.findMany({ where: { status: "Paid" }, select: { createdAt: true, totalAmount: true } })
    ]);

    const yearlyData = new Map();

    weeklyIncomes.forEach(item => {
      const year = new Date(item.createdAt).getFullYear().toString();
      if (!yearlyData.has(year)) yearlyData.set(year, { year, income: 0, expense: 0 });
      yearlyData.get(year).income += item.subTotal || 0;
    });

    weeklyExpenses.forEach(item => {
      const year = new Date(item.createdAt).getFullYear().toString();
      if (!yearlyData.has(year)) yearlyData.set(year, { year, income: 0, expense: 0 });
      yearlyData.get(year).expense += item.totalAmount || 0;
    });

    const currentYear = new Date().getFullYear();
    const result = [];
    for (let i = 0; i < 10; i++) {
      const year = (currentYear - i).toString();
      result.push(yearlyData.get(year) || { year, income: 0, expense: 0 });
    }

    res.json({ success: true, data: result.reverse() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getInvoiceInfo = async (req, res) => {
  const { type, transactionId, detailsId } = req.query;
  try {
    if (type === "income") {
      const [incomeTransaction, details, allDetails] = await prisma.$transaction([
        prisma.incomeTransaction.findUnique({
          where: { id: transactionId },
          include: {
            serviceAgreement: {
              include: { service: true, subService: true, client: true }
            }
          }
        }),
        prisma.incomeTransactionDetails.findUnique({ where: { id: detailsId } }),
        prisma.incomeTransactionDetails.findMany({ where: { incomeTransactionId: transactionId } })
      ]);

      const detailsSum = allDetails.reduce((prev, current) => prev + current.paidAmount, 0);
      const pending = (incomeTransaction.subTotal || 0) - detailsSum;

      res.json({
        success: true,
        data: {
          description: incomeTransaction.serviceAgreement.description,
          headerInfo: {
            createdAt: details.createdAt,
            duetoDate: incomeTransaction.duetoDate,
            id: incomeTransaction.id,
            clientName: incomeTransaction.serviceAgreement.client.institution,
            phone: incomeTransaction.serviceAgreement.client.phone,
            email: incomeTransaction.serviceAgreement.client.email,
            subTotal: incomeTransaction.subTotal,
          },
          items: [{
            service: incomeTransaction.serviceAgreement.service.serviceName,
            package: incomeTransaction.serviceAgreement.subService.name,
            totalAmount: incomeTransaction.totalAmount,
            discount: incomeTransaction.discount,
            tax: `${incomeTransaction.taxValue} | ${incomeTransaction.taxType}`,
            subTotal: incomeTransaction.subTotal,
            paidNow: details.paidAmount,
            pending: pending.toFixed(2),
          }]
        }
      });
    } else {
      const [expenseTransaction, details, allDetails] = await prisma.$transaction([
        prisma.expenseTransaction.findUnique({
          where: { id: transactionId },
          include: { expenseServiceAgreement: true, expense: true }
        }),
        prisma.expenseTransactionDetails.findUnique({ where: { id: detailsId } }),
        prisma.expenseTransactionDetails.findMany({ where: { expenseTransactionId: transactionId } })
      ]);

      const detailsSum = allDetails.reduce((prev, current) => prev + current.paidAmount, 0);
      const pending = expenseTransaction.totalAmount - detailsSum;

      res.json({
        success: true,
        data: {
          description: expenseTransaction.expenseServiceAgreement.description,
          headerInfo: {
            createdAt: details.createdAt,
            duetoDate: expenseTransaction.duetoDate,
            id: expenseTransaction.id,
            clientName: "Expense Transaction",
          },
          items: [{
            expenseType: expenseTransaction.expense.expenseType,
            totalAmount: expenseTransaction.totalAmount,
            paidNow: details.paidAmount,
            pending: pending.toFixed(2),
          }]
        }
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
export const getPaymentReport = async (req, res) => {
  const { fromMonth, toMonth, type } = req.query;
  try {
    const from = fromMonth ? new Date(fromMonth) : undefined;
    const to = toMonth ? new Date(toMonth) : undefined;
    const filterConditions = { createdAt: { gte: from, lte: to } };

    if (type === "income") {
      const incomes = await prisma.incomeTransaction.findMany({
        where: { AND: filterConditions, status: "Paid" },
        include: { income: true }
      });

      const grouped = incomes.reduce((acc, curr) => {
        const key = curr.incomeCategoryId || "unknown";
        if (!acc[key]) acc[key] = { amount: 0, type: curr.income?.incomeType || "Other" };
        acc[key].amount += curr.subTotal || 0;
        return acc;
      }, {});

      const items = Object.values(grouped).map(item => ({
        Date: fromMonth && toMonth ? `From ${fromMonth} to ${toMonth}` : "All Dates",
        Amount: item.amount.toFixed(2),
        "Paid By": "System",
        incomeType: item.type
      }));

      res.json({ success: true, data: { items, total: items.reduce((sum, i) => sum + parseFloat(i.Amount), 0).toFixed(2) } });
    } else {
      const [expenses, salaries] = await prisma.$transaction([
        prisma.expenseTransaction.findMany({
          where: { AND: filterConditions, status: "Paid" },
          include: { expense: true }
        }),
        prisma.userSalary.findMany({
          where: { AND: filterConditions, status: "Paid" }
        })
      ]);

      const grouped = expenses.reduce((acc, curr) => {
        const key = curr.expenseCategoryId || "unknown";
        if (!acc[key]) acc[key] = { amount: 0, type: curr.expense?.expenseType || "Other" };
        acc[key].amount += curr.totalAmount || 0;
        return acc;
      }, {});

      const items = Object.values(grouped).map(item => ({
        Date: fromMonth && toMonth ? `From ${fromMonth} to ${toMonth}` : "All Dates",
        Amount: item.amount.toFixed(2),
        "Expense Type": item.type
      }));

      if (salaries.length > 0) {
        items.push({
          Date: fromMonth && toMonth ? `From ${fromMonth} to ${toMonth}` : "All Dates",
          Amount: salaries.reduce((sum, s) => sum + s.totalAmount, 0).toFixed(2),
          "Expense Type": "Staff Salaries"
        });
      }

      res.json({ success: true, data: { items, total: items.reduce((sum, i) => sum + parseFloat(i.Amount), 0).toFixed(2) } });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
