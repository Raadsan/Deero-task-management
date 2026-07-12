"use client";

import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import PaymentPaidPage from "@/components/payments/PaymentPaidPage";

export default function PaymentPaidRoutePage() {
  return (
    <ManagementPageShell title="Paid Payments">
      <PaymentPaidPage />
    </ManagementPageShell>
  );
}
