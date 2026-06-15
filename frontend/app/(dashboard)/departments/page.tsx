import DepartmentsManagementPage from "@/components/departments/DepartmentsManagementPage";
import { GeneralTableSkeletonLoader } from "@/components/Shared/Loader";
import { Suspense } from "react";

export default function DepartmentsPage() {
  return (
    <Suspense fallback={<GeneralTableSkeletonLoader />}>
      <DepartmentsManagementPage />
    </Suspense>
  );
}
