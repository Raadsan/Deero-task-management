import { GetAssigneesAndInstitutions } from "@/lib/actions/shared.action";
import { getTaskById } from "@/lib/actions/task.action";
import TaskForm from "./TaskForm";

interface Props {
  formType: "own:edit" | "edit" | "create";
  params?: Promise<Record<string, string>>;
}
export default async function TaskformWrapper({ formType, params }: Props) {
  let taskResult = undefined;
  let institutions = undefined;

  if (formType !== "create" && params) {
    const { id: taskId } = await params;
    taskResult = await getTaskById(taskId);
  }

  if (formType === "create") {
    const result = await GetAssigneesAndInstitutions({});
    institutions = result?.data?.institutions;
  }

  return (
    <section className="h-full w-full">
      <TaskForm
        formType={formType}
        institutions={institutions}
        currentTask={taskResult?.data}
      />
    </section>
  );
}
