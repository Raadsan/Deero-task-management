import PaymentWrapper from "@/components/payments/PaymentWrapper";
import ColumnBuilder from "@/components/Shared/ColumnBuilder";
import HeaderBuilder from "@/components/Shared/HeaderBuilder";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import { ROUTES } from "@/lib/constants";
import { Suspense } from "react";

export default function ExpensePage() {
  return (
    <ColumnBuilder headerClassNames="bannerGradinetBg text-white">
      <HeaderBuilder headerText={"Register Expense"} showBlurLine={false} />
      <div className="size-full">
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
      </div>
    </ColumnBuilder>
  );
}
