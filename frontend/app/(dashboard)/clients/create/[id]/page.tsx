import AddServiceWrapper from "@/components/clients/AddServiceWrapper";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import { ClientFormSkeleton } from "@/components/Shared/Loader";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import { ROUTES } from "@/lib/constants";
import { PageParams } from "@/lib/types";
import { Suspense } from "react";

export default function AddServicePage({ params }: PageParams) {
  return (
    <ManagementPageShell title="Create Service">
      <PageBreadcrumb
        links={[
          {
            title: "Clients",
            link: ROUTES.clients,
          },
        ]}
      />
      <Suspense fallback={<ClientFormSkeleton />}>
        <AddServiceWrapper params={params} />
      </Suspense>
    </ManagementPageShell>
  );
}
