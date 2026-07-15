import ClientForm from "@/components/clients/ClientForm";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import { ClientFormSkeleton } from "@/components/Shared/Loader";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import { ROUTES } from "@/lib/constants";
import { getClientById } from "@/lib/actions/client.action";
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
        <AddServiceForm params={params} />
      </Suspense>
    </ManagementPageShell>
  );
}

async function AddServiceForm({
  params,
}: {
  params: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const result = await getClientById(id);
  return <ClientForm formType="addService" currentClient={result.data} />;
}
