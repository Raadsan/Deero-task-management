import SalaryPaymentWrapper from "@/components/payments/SalaryPaymentWrapper";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import { ClientFormSkeleton } from "@/components/Shared/Loader";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import { ROUTES } from "@/lib/constants";
import { PageParams } from "@/lib/types";
import { Suspense } from "react";

export default function SalaryPage({ params }: PageParams) {
  return (
    <ManagementPageShell title="User Salary Management">
      <PageBreadcrumb
        links={[
          {
            title: "Users",
            link: ROUTES.users,
          },
        ]}
      />
      <Suspense fallback={<ClientFormSkeleton />}>
        <SalaryPaymentWrapper params={params} />
      </Suspense>
    </ManagementPageShell>
  );
}
