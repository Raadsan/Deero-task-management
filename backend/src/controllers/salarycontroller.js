import { prisma } from "../lib/prisma.js";

export const getAllSalaries = async (req, res) => {
  try {
    const salaries = await prisma.userSalary.findMany({
      include: { recieverUser: true, registeredUser: true, UserSalaryDetails: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: salaries });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const paySalary = async (req, res) => {
  const { totalAmount, amountPaid, tax, status, method, recieceverId, registeredById, duetoDate, taxtType, createdAt } = req.body;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const salaryTransaction = await tx.userSalary.create({
        data: {
          tax,
          method,
          status,
          dueToDate: duetoDate ? new Date(duetoDate) : null,
          totalAmount: parseFloat(totalAmount),
          recieverId: recieceverId,
          registeredBy: registeredById,
          taxType: taxtType || "",
        },
      });

      await tx.userSalaryDetails.create({
        data: {
          paidAmount: parseFloat(amountPaid),
          createdAt: createdAt ? new Date(createdAt) : new Date(),
          salaryId: salaryTransaction.id,
        },
      });
      return salaryTransaction;
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getUserSalaryDetails = async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await prisma.userSalary.findMany({
      where: { recieverId: userId },
      include: {
        UserSalaryDetails: true,
        recieverUser: { select: { name: true } },
        registeredUser: { select: { name: true } }
      }
    });

    const transformed = result.map(item => ({
      salaryId: item.id,
      createdAt: item.createdAt,
      dueToDate: item.dueToDate,
      totalAmount: item.totalAmount,
      tax: item.tax,
      status: item.status,
      method: item.method,
      notes: item.notes || "",
      taxType: item.taxType,
      recieverName: item.recieverUser.name,
      registeredBy: item.registeredUser.name,
      detials: item.UserSalaryDetails.map(d => ({
        id: d.id,
        paidAt: d.createdAt,
        paidAmount: d.paidAmount
      }))
    }));

    res.json({ success: true, data: transformed });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getSalaryReport = async (req, res) => {
  const { fromMonth, toMonth } = req.query;
  try {
    const from = fromMonth ? new Date(fromMonth) : undefined;
    const to = toMonth ? new Date(toMonth) : undefined;
    const filterConditions = { createdAt: { gte: from, lte: to } };

    const salaries = await prisma.userSalary.findMany({
      where: { AND: filterConditions, status: "Paid" },
      include: { recieverUser: { select: { name: true } } }
    });

    const grouped = salaries.reduce((acc, curr) => {
      if (!acc[curr.recieverId]) acc[curr.recieverId] = { name: curr.recieverUser.name, total: 0 };
      acc[curr.recieverId].total += curr.totalAmount;
      return acc;
    }, {});

    const data = Object.values(grouped).map(item => ({
      name: item.name,
      total: item.total.toFixed(2),
      paidAt: fromMonth && toMonth ? `From ${fromMonth} to ${toMonth}` : "All Dates"
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

