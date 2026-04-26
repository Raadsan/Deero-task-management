import ColumnBuilder from "@/components/Shared/ColumnBuilder";
import HeaderBuilder from "@/components/Shared/HeaderBuilder";
import {
  GeneralTableSkeletonLoader,
  UserSkelton,
} from "@/components/Shared/Loader";
import UserAvator from "@/components/Shared/UserAvator";
import MyTasksTable from "@/components/tasks/MyTaskstable";
import TaskNotifications from "@/components/tasks/TaskNotifications";
import { Suspense } from "react";

export default function MyTasksPage() {
  return (
    <ColumnBuilder>
      <div className="flex w-full items-center justify-between">
        <HeaderBuilder
          headerText={"Manage Your Personal Tasks Tasks"}
          classNames="w-fit"
          showBlurLine={true}
        />
        <div className="w-fit">
          <div className="flex items-center gap-2.5">
            <TaskNotifications />
            <Suspense fallback={<UserSkelton />}>
              <UserAvator />
            </Suspense>
          </div>
        </div>
      </div>
      <main className="flex h-full w-full shrink-0 flex-col">
        <Suspense fallback={<GeneralTableSkeletonLoader />}>
          <MyTasksTable />
        </Suspense>
      </main>
    </ColumnBuilder>
  );
}
