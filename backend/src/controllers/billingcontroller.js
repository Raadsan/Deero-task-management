import { prisma } from "../lib/prisma.js";
import { computeStatus } from "../lib/monthly-billing-generator.js";
import { getScope } from "../lib/branch-scope.js";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function installmentWhere(scope, filters = {}) {
  const { status, clientId, tab, year, month } = filters;
  const where = {};

  if (clientId) where.clientId = clientId;
  if (year) where.periodYear = Number(year);
  if (month) where.periodMonth = Number(month);

  if (tab === "paid") {
    where.status = "PAID";
  } else if (tab === "unpaid") {
    where.AND = [
      { status: { in: ["PENDING", "OVERDUE"] } },
      { paidAmount: 0 },
    ];
  } else if (tab === "partial") {
    where.AND = [
      { paidAmount: { gt: 0 } },
      { status: { not: "PAID" } },
    ];
  } else if (status) {
    where.status = status;
  }

  if (scope?.branchId) {
    where.client = { branchId: scope.branchId };
  }

  return where;
}

function serializeInstallment(row) {
  const balance = Math.max(0, row.dueAmount - row.paidAmount);
  return {
    id: row.id,
    clientId: row.clientId,
    clientName: row.client?.institution ?? row.client?.companyName ?? "—",
    contractId: row.contractId,
    contractNumber: row.contract?.contractNumber ?? null,
    periodYear: row.periodYear,
    periodMonth: row.periodMonth,
    periodLabel: `${MONTH_NAMES[row.periodMonth - 1]} ${row.periodYear}`,
    dueDate: row.dueDate,
    dueAmount: row.dueAmount,
    paidAmount: row.paidAmount,
    balance,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const getInstallments = async (req, res) => {
  try {
    const scope = getScope(req);
    const { tab, clientId, year, month, status } = req.query;

    const rows = await prisma.clientInstallment.findMany({
      where: installmentWhere(scope, { tab, clientId, year, month, status }),
      include: {
        client: { select: { institution: true, companyName: true, branchId: true } },
        contract: { select: { contractNumber: true } },
      },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }, { dueDate: "desc" }],
    });

    const data = rows.map(serializeInstallment);

    const summary = {
      total: data.length,
      paid: data.filter((r) => r.status === "PAID").length,
      unpaid: data.filter((r) => ["PENDING", "OVERDUE"].includes(r.status)).length,
      partial: data.filter(
        (r) => r.paidAmount > 0 && r.status !== "PAID",
      ).length,
      totalDue: data.reduce((s, r) => s + r.dueAmount, 0),
      totalPaid: data.reduce((s, r) => s + r.paidAmount, 0),
      totalBalance: data.reduce((s, r) => s + r.balance, 0),
    };

    res.json({ success: true, data, summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getClientPaymentSummary = async (req, res) => {
  try {
    const scope = getScope(req);
    const { clientId } = req.params;

    const where = { clientId };
    if (scope?.branchId) {
      where.client = { branchId: scope.branchId };
    }

    const rows = await prisma.clientInstallment.findMany({
      where,
      include: {
        client: { select: { institution: true, companyName: true } },
        contract: { select: { contractNumber: true } },
      },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    });

    const installments = rows.map(serializeInstallment);
    const paidMonths = installments.filter((r) => r.status === "PAID");
    const unpaidMonths = installments.filter((r) =>
      ["PENDING", "PARTIAL", "OVERDUE"].includes(r.status),
    );

    res.json({
      success: true,
      data: {
        clientId,
        clientName: installments[0]?.clientName ?? null,
        totalMonths: installments.length,
        paidMonths: paidMonths.length,
        unpaidMonths: unpaidMonths.length,
        totalPaid: paidMonths.reduce((s, r) => s + r.paidAmount, 0),
        totalOutstanding: unpaidMonths.reduce((s, r) => s + r.balance, 0),
        installments,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const recordInstallmentPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const amount = Number(req.body?.amount);
    const notes = req.body?.notes?.trim() || null;

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Payment amount must be greater than zero",
      });
    }

    const existing = await prisma.clientInstallment.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Installment not found" });
    }

    const newPaid = Math.min(
      existing.dueAmount,
      Math.round((existing.paidAmount + amount) * 100) / 100,
    );
    const status = computeStatus(
      existing.dueAmount,
      newPaid,
      existing.dueDate,
    );

    const updated = await prisma.clientInstallment.update({
      where: { id },
      data: {
        paidAmount: newPaid,
        status,
        notes: notes ?? existing.notes,
      },
      include: {
        client: { select: { institution: true, companyName: true } },
        contract: { select: { contractNumber: true } },
      },
    });

    res.json({ success: true, data: serializeInstallment(updated) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getBillingReportData = async (req, res) => {
  try {
    const scope = getScope(req);
    const where = installmentWhere(scope, req.query);

    const rows = await prisma.clientInstallment.findMany({
      where,
      include: {
        client: { select: { institution: true, companyName: true } },
        contract: { select: { contractNumber: true } },
      },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    });

    const data = rows.map(serializeInstallment);

    const byMonth = {};
    for (const row of data) {
      const key = row.periodLabel;
      if (!byMonth[key]) {
        byMonth[key] = { label: key, due: 0, paid: 0, balance: 0, count: 0 };
      }
      byMonth[key].due += row.dueAmount;
      byMonth[key].paid += row.paidAmount;
      byMonth[key].balance += row.balance;
      byMonth[key].count += 1;
    }

    res.json({
      success: true,
      data: {
        rows: data,
        chartByMonth: Object.values(byMonth),
        summary: {
          total: data.length,
          paid: data.filter((r) => r.status === "PAID").length,
          unpaid: data.filter((r) => ["PENDING", "OVERDUE"].includes(r.status)).length,
          partial: data.filter(
        (r) => r.paidAmount > 0 && r.status !== "PAID",
      ).length,
          totalDue: data.reduce((s, r) => s + r.dueAmount, 0),
          totalPaid: data.reduce((s, r) => s + r.paidAmount, 0),
          totalBalance: data.reduce((s, r) => s + r.balance, 0),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
