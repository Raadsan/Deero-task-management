import TasksManagementPage from "@/components/tasks/TasksManagementPage";
import { Suspense } from "react";

export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-1 animate-pulse space-y-6 pb-8">
          <div className="h-16 rounded-xl bg-muted/20" />
          <div className="h-[480px] rounded-xl bg-muted/20" />
        </div>
      }
    >
      <TasksManagementPage />
    </Suspense>
  );
}
