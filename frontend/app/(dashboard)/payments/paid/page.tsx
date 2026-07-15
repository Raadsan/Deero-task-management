"use client";

import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import PaymentInstallmentsPage from "@/components/payments/PaymentInstallmentsPage";

export default function PaymentPaidRoutePage() {
  return (
    <ManagementPageShell title="Paid Payments">
      <PaymentInstallmentsPage
        mode="paid"
        emptyMessage="No paid payments recorded for this period."
      />
    </ManagementPageShell>
  );
}
