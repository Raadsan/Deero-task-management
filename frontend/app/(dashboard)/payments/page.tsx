import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import PaymentDashboard from "@/components/payments/PaymentDashboard";
import { Suspense } from "react";

export default function PaymentsPage() {
  return (
    <ManagementPageShell title="Payments">
      <Suspense
        fallback={
          <div className="h-96 animate-pulse rounded-xl bg-muted/20" />
        }
      >
        <PaymentDashboard />
      </Suspense>
    </ManagementPageShell>
  );
}
