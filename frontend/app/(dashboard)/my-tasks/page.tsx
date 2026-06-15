import MyTasksManagementPage from "@/components/tasks/MyTasksManagementPage";
import { GeneralTableSkeletonLoader } from "@/components/Shared/Loader";
import { Suspense } from "react";

export default function MyTasksPage() {
  return (
    <Suspense fallback={<GeneralTableSkeletonLoader />}>
      <MyTasksManagementPage />
    </Suspense>
  );
}
