import ClientsManagementPage from "@/components/clients/ClientsManagementPage";
import { GeneralTableSkeletonLoader } from "@/components/Shared/Loader";
import { Suspense } from "react";

export default function ClientsPage() {
  return (
    <Suspense fallback={<GeneralTableSkeletonLoader />}>
      <ClientsManagementPage />
    </Suspense>
  );
}
