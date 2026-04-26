import InvoiceWrapper from "@/components/invoice/InvoiceWrapper";
import ColumnBuilder from "@/components/Shared/ColumnBuilder";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import { ROUTES } from "@/lib/constants";
import { PageParams } from "@/lib/types";
import { Suspense } from "react";

export default async function CreateInvoice({
  params,
  searchParams,
}: PageParams) {
  return (
    <ColumnBuilder>
      <PageBreadcrumb
        links={[
          {
            title: "Payment",
            link: ROUTES.payments,
          },
        ]}
      />
      <Suspense>
        <InvoiceWrapper searchParams={searchParams} params={params} />
      </Suspense>
    </ColumnBuilder>
  );
}
