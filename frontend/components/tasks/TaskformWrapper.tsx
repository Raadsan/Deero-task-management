import { getTaskById } from "@/lib/actions/task.action";
import TaskForm from "./TaskForm";

interface Props {
  formType: "own:edit" | "edit" | "create";
  params?: Promise<Record<string, string>>;
}
export default async function TaskformWrapper({ formType, params }: Props) {
  let taskResult = undefined;

  if (formType !== "create" && params) {
    const { id: taskId } = await params;
    taskResult = await getTaskById(taskId);
  }

  if (formType === "create") {
    return (
      <section className="h-full w-full">
        <TaskForm formType={formType} />
      </section>
    );
  }

  return (
    <section className="h-full w-full">
      <TaskForm formType={formType} currentTask={taskResult?.data} />
    </section>
  );
}
