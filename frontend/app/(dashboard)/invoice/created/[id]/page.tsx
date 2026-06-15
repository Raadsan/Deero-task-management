import InvoiceWrapper from "@/components/invoice/InvoiceWrapper";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import { ROUTES } from "@/lib/constants";
import { PageParams } from "@/lib/types";
import { Suspense } from "react";

export default async function CreateInvoice({
  params,
  searchParams,
}: PageParams) {
  return (
    <ManagementPageShell title="Invoice">
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
    </ManagementPageShell>
  );
}
