import { DashboardCharts } from "@/components/home/DashboardCharts";
import DashboardMetric from "@/components/home/DashboardMetric";
import Sources from "@/components/home/Sources";
import ColumnBuilder from "@/components/Shared/ColumnBuilder";
import { UserSkelton } from "@/components/Shared/Loader";
import PageDatePicker from "@/components/Shared/PageDatePicker";
import UserAvator from "@/components/Shared/UserAvator";
import { Suspense } from "react";

export default async function Home() {
  return (
    <ColumnBuilder headerClassNames="flex justify-end">
      <Suspense fallback={<UserSkelton />}>
        <UserAvator />
      </Suspense>
      <main className="flex h-full w-full shrink-0 grow flex-col gap-[54px]">
        <Suspense>
          <PageDatePicker classNames="ml-auto" />
          <DashboardMetric />
          <Sources />
          <DashboardCharts />
        </Suspense>
      </main>
    </ColumnBuilder>
  );
}
