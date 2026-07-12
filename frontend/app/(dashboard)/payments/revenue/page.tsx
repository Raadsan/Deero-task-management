"use client";

import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import PaymentRevenuePage from "@/components/payments/PaymentRevenuePage";

export default function PaymentRevenueRoutePage() {
  return (
    <ManagementPageShell title="All Payments">
      <PaymentRevenuePage />
    </ManagementPageShell>
  );
}
