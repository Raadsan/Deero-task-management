import PaymentWrapper from "@/components/payments/PaymentWrapper";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import { ROUTES } from "@/lib/constants";
import { Suspense } from "react";

export default function ExpensePage() {
  return (
    <ManagementPageShell title="Register Expense">
      <PageBreadcrumb
        links={[
          {
            title: "Payment Revenue",
            link: ROUTES.paymentsRevenue,
          },
        ]}
      />
      <Suspense>
        <PaymentWrapper type={"expense"} />
      </Suspense>
    </ManagementPageShell>
  );
}
