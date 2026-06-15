import MenusConfigPage from "@/components/config/MenusConfigPage";
import { GeneralTableSkeletonLoader } from "@/components/Shared/Loader";
import { Suspense } from "react";

export default function ConfigMenusPage() {
  return (
    <Suspense fallback={<GeneralTableSkeletonLoader />}>
      <MenusConfigPage />
    </Suspense>
  );
}
