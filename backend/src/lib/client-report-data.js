import { attachClientOpeningBalances } from "./client-opening-balance.js";
import { clientBranchWhere, contractBranchWhere, mergeWhere } from "./portfolio-scope.js";

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function formatMoney(value) {
  return round2(value);
}

function formatDay(value) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function invoicePaymentLabel(state) {
  const normalized = String(state || "").toLowerCase();
  if (normalized === "paid") return "Paid";
  if (normalized === "partial" || normalized === "in_payment") return "Partially Paid";
  return "Unpaid";
}

function invoiceMatchesPaymentFilter(invoice, paymentStatus) {
  if (!paymentStatus || paymentStatus === "all") return true;
  const normalized = String(invoice.payment_state || "").toLowerCase();
  if (paymentStatus === "paid") return normalized === "paid";
  if (paymentStatus === "partial") return normalized === "partial" || normalized === "in_payment";
  if (paymentStatus === "unpaid") return normalized === "not_paid" || normalized === "unpaid";
  return true;
}

function inDateRange(day, from, to) {
  if (!day) return !from && !to;
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export async function loadReportClients(prisma, scope, clientId) {
  const where = mergeWhere(clientBranchWhere(scope), clientId ? { id: clientId } : {});
  const rows = await prisma.client.findMany({
    where: { ...where, isDraft: false },
    select: {
      id: true,
      institution: true,
      companyName: true,
      contactPerson: true,
      phone: true,
      email: true,
      address: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { institution: "asc" },
    take: 500,
  });
  await attachClientOpeningBalances(prisma, rows);
  return rows;
}

export async function loadClientFinancials(prisma, clientIds, { from = "", to = "", paymentStatus = "" } = {}) {
  if (!clientIds.length) {
    return { invoices: [], receipts: [], creditNotes: [], totals: { invoiced: 0, received: 0, due: 0, credit: 0 } };
  }

  const invoices = await prisma.customer_invoices.findMany({
    where: {
      client_id: { in: clientIds },
      state: "posted",
    },
    select: {
      id: true,
      client_id: true,
      invoice_number: true,
      invoice_date: true,
      amount_total: true,
      paid_amount: true,
      amount_due: true,
      payment_state: true,
      document_type: true,
      customer_reference: true,
      notes: true,
    },
    orderBy: { invoice_date: "desc" },
    take: 2000,
  });

  const invoiceDocs = invoices.filter((row) => row.document_type === "invoice");
  const creditDocs = invoices.filter((row) => row.document_type === "credit_note");

  const customers = await prisma.customers.findMany({
    where: { clientId: { in: clientIds } },
    select: { id: true, clientId: true },
  });
  const customerIds = customers.map((row) => row.id);
  const customerToClient = new Map(customers.map((row) => [row.id, row.clientId]));

  const receipts = customerIds.length
    ? await prisma.customer_receipts.findMany({
      where: { customer_id: { in: customerIds }, state: "posted" },
      select: {
        id: true,
        customer_id: true,
        receipt_number: true,
        receipt_date: true,
        amount: true,
        state: true,
        memo: true,
        payment_methods: { select: { name: true } },
        receipt_allocations: {
          select: {
            allocated_amount: true,
            customer_invoices: { select: { id: true, invoice_number: true } },
          },
        },
      },
      orderBy: { receipt_date: "desc" },
      take: 2000,
    })
    : [];

  const mappedInvoices = invoiceDocs
    .filter((row) => inDateRange(String(row.invoice_date).slice(0, 10), from, to))
    .filter((row) => invoiceMatchesPaymentFilter(row, paymentStatus))
    .map((row) => ({
      id: row.id,
      clientId: row.client_id,
      number: row.invoice_number || `INV-${row.id}`,
      date: formatDay(row.invoice_date),
      contract: row.customer_reference || "—",
      installment: "—",
      amount: formatMoney(row.amount_total),
      advanceApplied: 0,
      paid: formatMoney(row.paid_amount),
      balanceDue: formatMoney(row.amount_due),
      status: invoicePaymentLabel(row.payment_state),
      paymentState: row.payment_state,
    }));

  const mappedReceipts = receipts
    .filter((row) => inDateRange(String(row.receipt_date).slice(0, 10), from, to))
    .map((row) => {
      const allocation = row.receipt_allocations?.[0];
      return {
        id: row.id,
        clientId: customerToClient.get(row.customer_id) || "",
        number: row.receipt_number || `RCP-${row.id}`,
        date: formatDay(row.receipt_date),
        invoiceNumber: allocation?.customer_invoices?.invoice_number || "—",
        method: row.payment_methods?.name || "—",
        amount: formatMoney(row.amount),
        status: "Posted",
      };
    });

  const mappedCredits = creditDocs
    .filter((row) => inDateRange(String(row.invoice_date).slice(0, 10), from, to))
    .map((row) => ({
      id: row.id,
      clientId: row.client_id,
      number: row.invoice_number || `CN-${row.id}`,
      date: formatDay(row.invoice_date),
      originalInvoice: row.customer_reference || "—",
      totalCredit: formatMoney(row.amount_total),
      appliedReceivable: formatMoney(Math.max(0, formatMoney(row.amount_total) - formatMoney(row.amount_due))),
      customerCredit: formatMoney(row.amount_due),
      status: "Posted",
    }));

  const totals = {
    invoiced: formatMoney(mappedInvoices.reduce((sum, row) => sum + row.amount, 0)),
    received: formatMoney(mappedReceipts.reduce((sum, row) => sum + row.amount, 0)),
    due: formatMoney(mappedInvoices.reduce((sum, row) => sum + row.balanceDue, 0)),
    credit: formatMoney(mappedCredits.reduce((sum, row) => sum + row.customerCredit, 0)),
  };

  return { invoices: mappedInvoices, receipts: mappedReceipts, creditNotes: mappedCredits, totals };
}

export function clientProfile(client) {
  if (!client) return null;
  return {
    id: client.id,
    clientCode: client.clientCode || client.id,
    name: client.companyName || client.institution,
    contactPerson: client.contactPerson || "—",
    phone: client.phone || "—",
    email: client.email || "—",
    address: client.address || "—",
    status: client.isActive ? "Active" : "Inactive",
    registrationDate: formatDay(client.createdAt),
  };
}

export function clientFinancialOverview(client, totals) {
  const opening = formatMoney(client?.openingBalanceAmount);
  const customerOwes = client?.openingBalanceType === "CUSTOMER_OWES";
  const weOwe = client?.openingBalanceType === "WE_OWE";
  return {
    openingBalance: opening,
    openingBalanceType: customerOwes ? "Customer Owes Us" : weOwe ? "We Owe Customer" : "—",
    totalContractValue: 0,
    totalInvoiced: totals?.invoiced ?? formatMoney(client?.totalInvoices),
    totalAdvanceCreditApplied: formatMoney(client?.availableAdvanceCredit),
    totalAmountPaid: totals?.received ?? formatMoney(client?.totalPaymentsReceived),
    totalCreditNotes: totals?.credit ?? 0,
    outstandingInvoiceBalance: totals?.due ?? formatMoney(client?.totalOutstandingReceivable),
    availableCustomerCredit: formatMoney(client?.availableAdvanceCredit),
    netCustomerBalance: formatMoney(client?.currentOutstandingBalance),
    balanceDirection: (client?.currentOutstandingBalance || 0) > 0 ? "Customer Owes Us" : (client?.availableAdvanceCredit || 0) > 0 ? "We Owe Customer" : "Settled",
  };
}

export async function loadClientContracts(prisma, scope, clientIds) {
  if (!clientIds.length) return [];
  return prisma.contract.findMany({
    where: mergeWhere(contractBranchWhere(scope), { clientId: { in: clientIds } }),
    select: {
      id: true,
      clientId: true,
      contractNumber: true,
      title: true,
      contractType: true,
      duration: true,
      startDate: true,
      endDate: true,
      totalAmount: true,
      paymentTerms: true,
      status: true,
      project: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

export function mapContractRow(contract) {
  return {
    id: contract.id,
    clientId: contract.clientId,
    number: contract.contractNumber,
    title: contract.title || "—",
    type: String(contract.contractType || "—"),
    duration: contract.duration || "—",
    startDate: formatDay(contract.startDate),
    endDate: formatDay(contract.endDate),
    amount: formatMoney(contract.totalAmount),
    paymentTerms: contract.paymentTerms || "—",
    status: String(contract.status || "—"),
    project: contract.project?.name || "—",
  };
}

export function organizationFinancialSummary(clients, financialByClient) {
  const contractValue = 0;
  let invoiced = 0;
  let received = 0;
  let due = 0;
  for (const client of clients) {
    const fin = financialByClient.get(client.id);
    invoiced += fin?.totals?.invoiced || formatMoney(client.totalInvoices);
    received += fin?.totals?.received || formatMoney(client.totalPaymentsReceived);
    due += fin?.totals?.due || formatMoney(client.totalOutstandingReceivable);
  }
  return {
    totalContractValue: contractValue,
    totalInvoiced: round2(invoiced),
    totalAmountReceived: round2(received),
    outstandingReceivables: round2(due),
  };
}