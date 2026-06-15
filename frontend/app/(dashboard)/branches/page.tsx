import BranchesManagementPage from "@/components/branches/BranchesManagementPage";
import { GeneralTableSkeletonLoader } from "@/components/Shared/Loader";
import { Suspense } from "react";

export default function BranchesPage() {
  return (
    <Suspense fallback={<GeneralTableSkeletonLoader />}>
      <BranchesManagementPage />
    </Suspense>
  );
}
