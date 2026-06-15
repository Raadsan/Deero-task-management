import PermissionsConfigPage from "@/components/config/PermissionsConfigPage";
import { GeneralTableSkeletonLoader } from "@/components/Shared/Loader";
import { Suspense } from "react";

export default function ConfigPermissionsPage() {
  return (
    <Suspense fallback={<GeneralTableSkeletonLoader />}>
      <PermissionsConfigPage />
    </Suspense>
  );
}
