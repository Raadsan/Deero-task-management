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
            title: "Payment",
            link: ROUTES.payments,
          },
        ]}
      />
      <Suspense>
        <PaymentWrapper type={"expense"} />
      </Suspense>
    </ManagementPageShell>
  );
}
