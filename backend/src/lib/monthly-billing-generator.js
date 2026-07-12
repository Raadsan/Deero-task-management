import { prisma } from "./prisma.js";

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function monthBounds(year, month) {
  const dueDay = 1;
  const dueDate = new Date(year, month - 1, dueDay);
  dueDate.setHours(23, 59, 59, 999);
  return { dueDate };
}

function contractMonths(startDate, endDate) {
  if (!startDate || !endDate) return 12;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    1;
  return Math.max(1, months);
}

function resolveMonthlyAmount(contract, client) {
  if (contract.monthlyAmount && contract.monthlyAmount > 0) {
    return contract.monthlyAmount;
  }
  if (client.monthlyBudget && client.monthlyBudget > 0) {
    return client.monthlyBudget;
  }
  if (contract.totalAmount && contract.totalAmount > 0) {
    const months = contractMonths(contract.startDate, contract.endDate);
    return Math.round((contract.totalAmount / months) * 100) / 100;
  }
  return null;
}

function isContractBillable(contract, year, month) {
  if (contract.status !== "ACTIVE") return false;

  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0, 23, 59, 59, 999);

  if (contract.startDate && periodEnd < startOfDay(contract.startDate)) {
    return false;
  }
  if (contract.endDate && periodStart > startOfDay(contract.endDate)) {
    return false;
  }

  return true;
}

function computeStatus(dueAmount, paidAmount, dueDate, now = new Date()) {
  if (paidAmount >= dueAmount) return "PAID";
  if (paidAmount > 0) {
    return startOfDay(now) > startOfDay(dueDate) ? "OVERDUE" : "PARTIAL";
  }
  return startOfDay(now) > startOfDay(dueDate) ? "OVERDUE" : "PENDING";
}

/**
 * Generate monthly installments for active contracts and recurring clients.
 * Marks overdue installments when due date has passed without full payment.
 */
export async function generateMonthlyInstallments({ runDate = new Date() } = {}) {
  const now = new Date(runDate);
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const contracts = await prisma.contract.findMany({
    where: { status: "ACTIVE" },
    include: {
      client: {
        select: {
          id: true,
          institution: true,
          monthlyBudget: true,
          clientType: true,
          isActive: true,
        },
      },
    },
  });

  let created = 0;
  let updated = 0;

  for (const contract of contracts) {
    if (!contract.client?.isActive) continue;
    if (!isContractBillable(contract, year, month)) continue;

    const dueAmount = resolveMonthlyAmount(contract, contract.client);
    if (!dueAmount || dueAmount <= 0) continue;

    const billingDay = Math.min(
      Math.max(contract.billingDay ?? 1, 1),
      28,
    );
    const dueDate = new Date(year, month - 1, billingDay);
    dueDate.setHours(23, 59, 59, 999);

    const sourceKey = `contract:${contract.id}`;

    const existing = await prisma.clientInstallment.findUnique({
      where: {
        sourceKey_periodYear_periodMonth: {
          sourceKey,
          periodYear: year,
          periodMonth: month,
        },
      },
    });

    if (!existing) {
      await prisma.clientInstallment.create({
        data: {
          sourceKey,
          periodYear: year,
          periodMonth: month,
          dueDate,
          dueAmount,
          paidAmount: 0,
          status: computeStatus(dueAmount, 0, dueDate, now),
          clientId: contract.clientId,
          contractId: contract.id,
        },
      });
      created += 1;
      continue;
    }

    if (existing.status === "PAID") continue;

    const status = computeStatus(
      existing.dueAmount,
      existing.paidAmount,
      existing.dueDate,
      now,
    );

    if (status !== existing.status) {
      await prisma.clientInstallment.update({
        where: { id: existing.id },
        data: { status },
      });
      updated += 1;
    }
  }

  const recurringClients = await prisma.client.findMany({
    where: {
      isActive: true,
      clientType: "MANAGED_RECURRING",
      monthlyBudget: { gt: 0 },
      contracts: { none: { status: "ACTIVE" } },
    },
    select: {
      id: true,
      monthlyBudget: true,
    },
  });

  for (const client of recurringClients) {
    const sourceKey = `client:${client.id}`;
    const { dueDate } = monthBounds(year, month);
    const dueAmount = client.monthlyBudget;

    const existing = await prisma.clientInstallment.findUnique({
      where: {
        sourceKey_periodYear_periodMonth: {
          sourceKey,
          periodYear: year,
          periodMonth: month,
        },
      },
    });

    if (!existing) {
      await prisma.clientInstallment.create({
        data: {
          sourceKey,
          periodYear: year,
          periodMonth: month,
          dueDate,
          dueAmount,
          paidAmount: 0,
          status: computeStatus(dueAmount, 0, dueDate, now),
          clientId: client.id,
        },
      });
      created += 1;
      continue;
    }

    if (existing.status === "PAID") continue;

    const status = computeStatus(
      existing.dueAmount,
      existing.paidAmount,
      existing.dueDate,
      now,
    );

    if (status !== existing.status) {
      await prisma.clientInstallment.update({
        where: { id: existing.id },
        data: { status },
      });
      updated += 1;
    }
  }

  const overdueCandidates = await prisma.clientInstallment.findMany({
    where: {
      status: { in: ["PENDING", "PARTIAL"] },
      dueDate: { lt: startOfDay(now) },
    },
  });

  for (const row of overdueCandidates) {
    await prisma.clientInstallment.update({
      where: { id: row.id },
      data: { status: "OVERDUE" },
    });
    updated += 1;
  }

  return {
    runDate: now.toISOString().slice(0, 10),
    periodYear: year,
    periodMonth: month,
    created,
    updated,
  };
}

export { computeStatus, resolveMonthlyAmount };
