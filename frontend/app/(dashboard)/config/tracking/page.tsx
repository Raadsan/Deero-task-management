import TrackingConfigPage from "@/components/config/TrackingConfigPage";
import { GeneralTableSkeletonLoader } from "@/components/Shared/Loader";
import { Suspense } from "react";

export default function ConfigTrackingPage() {
  return (
    <Suspense fallback={<GeneralTableSkeletonLoader />}>
      <TrackingConfigPage />
    </Suspense>
  );
}
