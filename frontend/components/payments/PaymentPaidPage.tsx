"use client";

import PaymentInstallmentsPage from "@/components/payments/PaymentInstallmentsPage";

export default function PaymentPaidPage() {
  return (
    <PaymentInstallmentsPage
      mode="paid"
      emptyMessage="No paid payments recorded for this period."
    />
  );
}
