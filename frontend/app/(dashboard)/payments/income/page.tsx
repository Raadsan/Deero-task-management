import PaymentWrapper from "@/components/payments/PaymentWrapper";
import ColumnBuilder from "@/components/Shared/ColumnBuilder";
import HeaderBuilder from "@/components/Shared/HeaderBuilder";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import { ROUTES } from "@/lib/constants";
import { PageParams } from "@/lib/types";
import { Suspense } from "react";

export default function IncomePage({ searchParams }: PageParams) {
  return (
    <ColumnBuilder headerClassNames="bannerGradinetBg text-white">
      <HeaderBuilder headerText={"Register Income"} showBlurLine={false} />
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
          <PaymentWrapper type={"income"} searchParams={searchParams} />
        </Suspense>
      </div>
    </ColumnBuilder>
  );
}
