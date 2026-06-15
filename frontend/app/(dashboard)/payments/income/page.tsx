import PaymentWrapper from "@/components/payments/PaymentWrapper";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import { ROUTES } from "@/lib/constants";
import { PageParams } from "@/lib/types";
import { Suspense } from "react";

export default function IncomePage({ searchParams }: PageParams) {
  return (
    <ManagementPageShell title="Register Income">
      <PageBreadcrumb
        links={[
          {
            title: "Payment",
            link: ROUTES.payments,
          },
        ]}
      />
      <Suspense>
        <PaymentWrapper type={"income"} searchParams={searchParams} />
      </Suspense>
    </ManagementPageShell>
  );
}
