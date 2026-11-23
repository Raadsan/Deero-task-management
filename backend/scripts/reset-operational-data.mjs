/**
 * Selective database reset: clears operational / transactional data while
 * keeping masters (CoA, journals setup, taxes, products, staff, roles, services,
 * portfolios, companies, currencies, payment terms, workflow templates, etc.).
 *
 * Clears:
 * - Accounting: journal entries (+ lines), customers, invoices, receipts,
 *   credit notes, vendors, bills, payments, advances, quotations
 * - Task management: tasks, projects, contracts, clients (+ linked CRM data)
 *
 * Usage:
 *   node scripts/reset-operational-data.mjs           # dry-run counts only
 *   node scripts/reset-operational-data.mjs --confirm # execute deletion
 */

import { PrismaClient } from "../lib/generated/prisma/index.js";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();
const confirm = process.argv.includes("--confirm");

async function count(label, fn) {
  const n = await fn();
  console.log(`  ${label}: ${n}`);
  return n;
}

async function runStep(label, fn) {
  const result = await fn();
  const n = result?.count ?? result ?? 0;
  console.log(`✓ ${label}: ${n}`);
  return result;
}

async function dryRunCounts() {
  console.log("\n--- Dry run (no changes) ---\n");
  console.log("Accounting:");
  await count("journal_items", () => prisma.journal_items.count());
  await count("journal_entries", () => prisma.journal_entries.count());
  await count("customer_invoices", () => prisma.customer_invoices.count());
  await count("customer_receipts", () => prisma.customer_receipts.count());
  await count("customers", () => prisma.customers.count());
  await count("vendor_bills", () => prisma.vendor_bills.count());
  await count("vendor_payments", () => prisma.vendor_payments.count());
  await count("vendor_advances", () => prisma.vendor_advances.count());
  await count("vendors", () => prisma.vendors.count());
  await count("quotations", () => prisma.quotations.count());

  console.log("\nTask management:");
  await count("tasks", () => prisma.task.count());
  await count("projects", () => prisma.project.count());
  await count("contracts", () => prisma.contract.count());
  await count("clients", () => prisma.client.count());
  await count("content_requests", () => prisma.contentRequest.count());
  await count("recurring_schedules", () => prisma.recurringSchedule.count());
}

async function resetOperationalData() {
  const maskedUrl = process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":****@");
  console.log("Database:", maskedUrl ?? "(DATABASE_URL not set)");
  console.log(confirm ? "Mode: LIVE DELETE" : "Mode: dry-run");

  if (!confirm) {
    await dryRunCounts();
    console.log(
      "\nNo data was deleted. Re-run with --confirm to execute the reset.\n"
    );
    return;
  }

  console.log("\n--- Starting selective reset ---\n");

  await prisma.$transaction(
    async (tx) => {
      // —— Accounting (children first) ——
      await runStep("quotation_lines", () => tx.quotation_lines.deleteMany({}));
      await tx.quotations.updateMany({ data: { converted_invoice_id: null } });
      await runStep("quotations", () => tx.quotations.deleteMany({}));

      await runStep("receipt_allocations", () =>
        tx.receipt_allocations.deleteMany({})
      );
      await runStep("customer_invoice_lines", () =>
        tx.customer_invoice_lines.deleteMany({})
      );

      await tx.customer_invoices.updateMany({
        data: { reversed_invoice_id: null, journal_entry_id: null },
      });
      await tx.customer_receipts.updateMany({ data: { journal_entry_id: null } });

      await runStep("customer_receipts", () =>
        tx.customer_receipts.deleteMany({})
      );
      await runStep("customer_invoices", () =>
        tx.customer_invoices.deleteMany({})
      );
      await runStep("customers", () => tx.customers.deleteMany({}));

      await runStep("payment_allocations", () =>
        tx.payment_allocations.deleteMany({})
      );
      await runStep("vendor_advance_applications", () =>
        tx.vendor_advance_applications.deleteMany({})
      );
      await runStep("vendor_advances", () => tx.vendor_advances.deleteMany({}));
      await tx.vendor_payments.updateMany({ data: { journal_entry_id: null } });
      await runStep("vendor_payments", () => tx.vendor_payments.deleteMany({}));
      await tx.vendor_bills.updateMany({
        data: { reversed_bill_id: null, journal_entry_id: null },
      });
      await runStep("vendor_bills", () => tx.vendor_bills.deleteMany({}));
      await runStep("vendors", () => tx.vendors.deleteMany({}));

      // Journal entries (cash transactions are manual JEs on cash/bank journals)
      await tx.journal_entries.updateMany({ data: { reversed_entry_id: null } });
      await tx.client.updateMany({ data: { openingJournalEntryId: null } });
      await runStep("client_opening_balance_history", () =>
        tx.clientOpeningBalanceHistory.deleteMany({})
      );
      await runStep("journal_entries", () => tx.journal_entries.deleteMany({}));

      // —— Task management ——
      await runStep("task notifications", () =>
        tx.notification.deleteMany({ where: { taskId: { not: null } } })
      );
      await runStep("recurring_task_occurrences", () =>
        tx.recurringTaskOccurrence.deleteMany({})
      );
      await runStep("task_transfer_history", () =>
        tx.taskTransferHistory.deleteMany({})
      );
      await runStep("clienttasks", () => tx.clientTask.deleteMany({}));
      await runStep("tasks", () => tx.task.deleteMany({}));

      await runStep("project_extra_requests", () =>
        tx.projectExtraRequest.deleteMany({})
      );
      await runStep("project_sub_services", () =>
        tx.projectSubService.deleteMany({})
      );
      await runStep("project_service_links", () =>
        tx.projectServiceLink.deleteMany({})
      );
      await runStep("project_cycles", () => tx.projectCycle.deleteMany({}));

      await tx.project.updateMany({ data: { contractId: null } });
      await tx.contract.updateMany({ data: { projectId: null } });

      await runStep("contract_documents", () =>
        tx.contractDocument.deleteMany({})
      );
      await runStep("client_installments", () =>
        tx.clientInstallment.deleteMany({})
      );
      await runStep("contracts", () => tx.contract.deleteMany({}));
      await runStep("projects", () => tx.project.deleteMany({}));

      await runStep("content_request_assignees", () =>
        tx.contentRequestAssignee.deleteMany({})
      );
      await runStep("content_requests", () => tx.contentRequest.deleteMany({}));
      await runStep("content_cycles", () => tx.contentCycle.deleteMany({}));
      await runStep("recurring_schedule_steps", () =>
        tx.recurringScheduleStep.deleteMany({})
      );
      await runStep("recurring_schedules", () =>
        tx.recurringSchedule.deleteMany({})
      );

      await runStep("income_transaction_details", () =>
        tx.incomeTransactionDetails.deleteMany({})
      );
      await runStep("income_transactions", () =>
        tx.incomeTransaction.deleteMany({})
      );
      await runStep("income_service_agreements", () =>
        tx.incomeServiceAgreement.deleteMany({})
      );

      await runStep("client_sub_services", () =>
        tx.clientSubService.deleteMany({})
      );
      await runStep("client_services", () => tx.clientService.deleteMany({}));
      await runStep("clients", () => tx.client.deleteMany({}));

      const counterEntities = [
        "tasks",
        "clients",
        "projects",
        "contracts",
        "content_requests",
        "recurring_schedules",
        "content_cycles",
      ];
      await runStep("counter sequences (task mgmt)", () =>
        tx.counter.deleteMany({ where: { entity: { in: counterEntities } } })
      );
    },
    { timeout: 120_000, maxWait: 30_000 }
  );

  console.log("\n==========================================");
  console.log("SUCCESS: Operational data cleared.");
  console.log("Preserved: staff, roles, services, portfolios, CoA,");
  console.log("journals (config), taxes, products, companies, banks,");
  console.log("payment methods/terms, workflow templates, old income/expense");
  console.log("categories (masters), nav menus, audit logs.");
  console.log("Reports & cash transactions clear automatically (no JEs left).");
  console.log("==========================================\n");
}

resetOperationalData()
  .catch((err) => {
    console.error("Reset failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());