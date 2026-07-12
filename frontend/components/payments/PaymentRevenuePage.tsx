"use client";

import PaymentInstallmentsPage from "@/components/payments/PaymentInstallmentsPage";

export default function PaymentRevenuePage() {
  return (
    <PaymentInstallmentsPage
      mode="all"
      emptyMessage="No monthly payments yet. Active contracts with monthly amounts auto-generate bills."
    />
  );
}
