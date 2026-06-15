import RolesConfigPage from "@/components/config/RolesConfigPage";
import { GeneralTableSkeletonLoader } from "@/components/Shared/Loader";
import { Suspense } from "react";

export default function ConfigRolesPage() {
  return (
    <Suspense fallback={<GeneralTableSkeletonLoader />}>
      <RolesConfigPage />
    </Suspense>
  );
}
