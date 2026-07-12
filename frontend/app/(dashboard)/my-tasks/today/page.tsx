import MyTasksTodayPage from "@/components/tasks/MyTasksTodayPage";
import { Suspense } from "react";

export default function TodayTasksPage() {
  return (
    <Suspense fallback={<div className="px-2 py-4 text-sm text-zinc-500">Loading today tasks...</div>}>
      <MyTasksTodayPage />
    </Suspense>
  );
}
