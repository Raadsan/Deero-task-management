import UsersManagementPage from "@/components/users/UsersManagementPage";
import { GeneralTableSkeletonLoader } from "@/components/Shared/Loader";
import { Suspense } from "react";

export default function UserPage() {
  return (
    <Suspense fallback={<GeneralTableSkeletonLoader />}>
      <UsersManagementPage />
    </Suspense>
  );
}
