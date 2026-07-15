"use client";

import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import PaymentInstallmentsPage from "@/components/payments/PaymentInstallmentsPage";

export default function PaymentRevenueRoutePage() {
  return (
    <ManagementPageShell title="All Payments">
      <PaymentInstallmentsPage
        mode="all"
        emptyMessage="No monthly payments yet. Active contracts with monthly amounts auto-generate bills."
      />
    </ManagementPageShell>
  );
}
