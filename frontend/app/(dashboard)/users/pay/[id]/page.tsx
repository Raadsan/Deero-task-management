import SalaryPaymentWrapper from "@/components/payments/SalaryPaymentWrapper";
import ColumnBuilder from "@/components/Shared/ColumnBuilder";
import HeaderBuilder from "@/components/Shared/HeaderBuilder";
import { ClientFormSkeleton } from "@/components/Shared/Loader";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import { ROUTES } from "@/lib/constants";
import { PageParams } from "@/lib/types";
import { Suspense } from "react";

export default function SalaryPage({ params }: PageParams) {
  return (
    <ColumnBuilder headerClassNames="bg-dark-red text-white">
      <HeaderBuilder showBlurLine headerText="User Salary Management" />
      <div className="w-full px-[30px] py-5">
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
      </div>
    </ColumnBuilder>
  );
}
