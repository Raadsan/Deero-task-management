import ServicesManagementPage from "@/components/services/ServicesManagementPage";
import { GeneralTableSkeletonLoader } from "@/components/Shared/Loader";
import { Suspense } from "react";

export default function ServicesPage() {
  return (
    <Suspense fallback={<GeneralTableSkeletonLoader />}>
      <ServicesManagementPage />
    </Suspense>
  );
}
