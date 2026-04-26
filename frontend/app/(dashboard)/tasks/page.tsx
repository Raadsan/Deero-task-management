import ColumnBuilder from "@/components/Shared/ColumnBuilder";
import HeaderBuilder from "@/components/Shared/HeaderBuilder";
import TasksTable from "@/components/tasks/TasksTable";
import TaskNotifications from "@/components/tasks/TaskNotifications";
import UserTaskReport from "@/components/tasks/UserTaskReport";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";

export default function TasksPage() {
  return (
    <ColumnBuilder headerClassNames="pb-[20px]">
      <HeaderBuilder
        headerText="Tasks"
        buttonText="+ Create Task"
        link={ROUTES.createTask}
        showBlurLine
      >
        <div className="mb-[30px] ml-auto flex w-fit gap-2.5">
          <TaskNotifications />
          <Suspense>
            <UserTaskReport />
          </Suspense>
          <Link href={ROUTES.createTask}>
            <Button
              className={cn(
                "via-dark-red to-secondary-100 cursor-pointer rounded-[10px] border border-none bg-linear-to-r from-orange-200 px-3 py-2 text-white hover:opacity-90",
              )}
            >
              Create a Task
            </Button>
          </Link>
        </div>
      </HeaderBuilder>
      <main className="flex h-full w-auto flex-col">
        <Suspense>
          <TasksTable />
        </Suspense>
      </main>
    </ColumnBuilder>
  );
}
