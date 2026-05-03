"use client";

import { createTask, editTask } from "@/lib/actions/task.action";
import { DEPARTMENTS, ROUTES, TASK_PRIORITIES } from "@/lib/constants";
import { getTaskStatus } from "@/lib/utils";
import { TaskSchema } from "@/lib/validations";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import ButtonBuilder from "../Shared/ButtonBuilder";

import {
  DatePicker,
  GetSelectItem,
  SelectElement,
  TextInput,
  TextInputWithTaxtArea,
} from "../Shared/FormElements";

import { authClient } from "@/lib/auth-client";
import { TaskPriority, TaskStatus } from "@/lib/schema";
import { Client, Task, User } from "@/lib/types";
import Loader from "../Shared/Loader";

interface Props {
  formType: "edit" | "create" | "own:edit";
  currentTask?: Task;
  institutions?: Pick<Client, "id" | "institution">[] | undefined;
  assignees?: Pick<User, "name" | "id" | "email" | "role" | "department">[];
}
export default function TaskForm({
  formType,
  currentTask,
  institutions,
  assignees,
}: Props) {
  const instituionId = currentTask ? currentTask.institutions[0] : undefined;

  const getDefaultInsitution = institutions?.find(
    (each) => each.id === instituionId?.id,
  );

  const {
    handleSubmit,
    register,
    setValue,
    reset,
    getValues,
    watch,
    setError,
    formState: { errors },
  } = useForm<z.infer<typeof TaskSchema>>({
    defaultValues: {
      description: currentTask?.description,
      assigneeId: currentTask?.assignedTo.id,
      status: currentTask?.status as TaskStatus,
      clientInstitutionId: String(getDefaultInsitution?.id ?? ""),
      department: currentTask?.department ?? "",
      priority: currentTask?.priority
        ? (currentTask.priority.charAt(0).toUpperCase() +
            currentTask.priority.slice(1)) as TaskPriority
        : "Normal",
      supervisor: currentTask?.supervisor ?? "",
      deadline: currentTask?.deadline
        ? new Date(currentTask.deadline)
        : new Date(),
      progress: currentTask?.progress || 0,
    },
    resolver: standardSchemaResolver(TaskSchema),
  });

  const taskStatus = getTaskStatus(formType);
  const session = authClient.useSession();

  const deadlineValue = watch("deadline");

  const [transiton, setStartTransition] = useTransition();
  const router = useRouter();

  const watchInstitutionId = watch("clientInstitutionId");
  const selectedInsitution = institutions?.find(
    (eachOne) => eachOne.id === watchInstitutionId,
  );
  const watchAssingneeId = watch("assigneeId");
  const currentUserId = session.data?.user.id;
  const isAssignee = String(currentUserId) === String(watchAssingneeId);

  const watchedDepartment = watch("department");
  const watchedPriority = watch("priority");
  const watchedStatus = watch("status");

  useEffect(() => {
    if (currentTask) {
      reset({
        description: currentTask.description,
        assigneeId: currentTask.assignedTo.id,
        status: currentTask.status.toLowerCase() as TaskStatus,
        clientInstitutionId: String(currentTask.institutions[0]?.id || ""),
        department: currentTask.department,
        priority: (currentTask.priority.charAt(0).toUpperCase() +
          currentTask.priority.slice(1)) as TaskPriority,
        supervisor: currentTask.supervisor,
        deadline: new Date(currentTask.deadline),
        progress: currentTask.progress || 0,
      });
    }
  }, [currentTask, reset]);

  console.log(taskStatus);

  console.log(taskStatus);
  function handleSubmitForm(data: z.infer<typeof TaskSchema>) {
    if (formType === "create") {
      setStartTransition(async () => {
        if (!data.clientInstitutionId) {
          return setError("clientInstitutionId", {
            type: "manual",
            message: "Please select a client institution",
          });
        }
        const result = await createTask({
          clientId: data.clientInstitutionId,
          assgineeId: data.assigneeId,
          description: data.description,
          status: data.status,
          department: data.department,
          priority: data.priority,
          supervisor: data.supervisor,
          deadline: data.deadline,
          progress: data.progress,
        });
        if (result?.success) {
          toast.success("Successfully Created Task.");
          return router.push(ROUTES.tasks);
        }
        toast.error(result?.errors?.message || "Failed to created Task");
      });
    } else if (formType === "edit") {
      startTransition(async () => {
        const result = await editTask({
          taskId: currentTask?.id!,
          deadline: data.deadline,
          status: data.status,
          assgineeId: data.assigneeId,
          description: data.description,
          department: data.department,
          priority: data.priority,
          supervisor: data.supervisor,
          progress: data.progress,
        });
        if (result.success) {
          toast.success("Successfully Edited Task");
          return router.push(ROUTES.tasks);
        }
        toast.error(result.errors?.message || "OOh! Failed to edit the task");
      });
    } else if (formType === "own:edit") {
      startTransition(async () => {
        const result = await editTask({
          ownEdit: true,
          taskId: currentTask?.id!,
          deadline: data.deadline,
          status: data.status,
          assgineeId: data.assigneeId,
          description: data.description,
          department: data.department,
          priority: data.priority,
          supervisor: data.supervisor,
          progress: data.progress,
        });
        if (result.success) {
          toast.success("Successfully Edited Task");
          return router.push(ROUTES.tasks);
        }
        toast.error(result.errors?.message || "OOh! Failed to edit the task");
      });
    }
  }

  return (
    <form
      onSubmit={handleSubmit(handleSubmitForm)}
      className="flex w-full flex-col flex-wrap gap-[20px]"
    >
      <TextInputWithTaxtArea
        labelId="title"
        labelText="Subject/Description"
        placeholder="Write the subject here"
        defaultValue={currentTask?.description}
        otherProps={{ ...register("description") }}
        disbaled={transiton || formType === "own:edit"}
        errorMessage={errors.description?.message}
        wrapperStyle="h-fit"
      />
      <SelectElement
        disbaleSelect={formType === "edit" || formType === "own:edit"}
        labelText="Select client Institution"
        placeholder="Select  Institution"
        defaultValue={getValues("clientInstitutionId")}
        errorMessage={errors.clientInstitutionId?.message}
        elementRenderer={() => {
          return institutions?.map(({ id, institution }, index) => {
            return (
              <GetSelectItem
                key={index}
                value={String(id)}
                label={institution}
              />
            );
          });
        }}
        onChange={(value) => {
          setValue("clientInstitutionId", value, {
            shouldValidate: true,
          });
        }}
      />

      <SelectElement
        labelText="Select Assignee"
        placeholder="Select Assignee"
        defaultValue={watchAssingneeId}
        disbaleSelect={transiton || formType === "own:edit"}
        errorMessage={errors.assigneeId?.message}
        elementRenderer={() => {
          return assignees?.map(({ name, id }, index) => {
            return (
              <GetSelectItem key={index} value={String(id)} label={name} />
            );
          });
        }}
        onChange={(value) => {
          setValue("assigneeId", value, { shouldValidate: true });
          const selectedUser = assignees?.find((u) => String(u.id) === value);
          if (selectedUser?.department) {
            setValue("department", selectedUser.department, {
              shouldValidate: true,
            });
          }
        }}
      />
      <SelectElement
        labelText="Department"
        placeholder="Select department"
        value={watchedDepartment}
        defaultValue={watchedDepartment}
        disbaleSelect={transiton || formType === "own:edit"}
        errorMessage={errors.department?.message}
        elements={[...DEPARTMENTS]}
        onChange={(value) => {
          setValue("department", value, { shouldValidate: true });
        }}
      />
      <SelectElement
        labelText="Priority"
        placeholder="Select priority"
        value={watchedPriority}
        defaultValue={watchedPriority}
        disbaleSelect={transiton || formType === "own:edit"}
        errorMessage={errors.priority?.message}
        elementRenderer={() => {
          return TASK_PRIORITIES.map((priority, index) => {
            return (
              <GetSelectItem
                key={index}
                value={priority}
                label={priority.charAt(0).toUpperCase() + priority.slice(1)}
              />
            );
          });
        }}
        onChange={(value) => {
          setValue("priority", value as TaskPriority, { shouldValidate: true });
        }}
      />
      <TextInput
        labelId="supervisor"
        labelText="Supervisor"
        placeholder="Enter Supervisor Name"
        defaultValue={getValues("supervisor")}
        otherProps={{ ...register("supervisor") }}
        disbaled={transiton || formType === "own:edit"}
        errorMessage={errors.supervisor?.message}
      />
      <SelectElement
        disbaleSelect={transiton}
        labelText="Select Task Status"
        placeholder="Select Status"
        value={watchedStatus}
        defaultValue={watchedStatus}
        errorMessage={errors.status?.message}
        elements={taskStatus}
        onChange={(value) => {
          setValue("status", value as TaskStatus, { shouldValidate: true });
        }}
      />
      <DatePicker
        labelText="Select Deadline"
        disbaled={transiton || session.data?.user.role === "user"}
        date={deadlineValue}
        showTimePicker
        setDate={(date) => {
          setValue("deadline", date, { shouldValidate: true });
        }}
        errorMessage={errors.deadline?.message}
      />

      <TextInput
        labelId="progress"
        labelText="Completion Percentage (%)"
        placeholder="Enter percentage (0-100)"
        type="number"
        defaultValue={String(getValues("progress"))}
        otherProps={{ ...register("progress", { valueAsNumber: true }) }}
        disbaled={!isAssignee || transiton}
        errorMessage={errors.progress?.message}
      />
      {!isAssignee && session.data?.user.role !== "user" && (
        <p className="text-[10px] text-gray-400 font-medium">
          Only the assigned user can update the progress.
        </p>
      )}

      <div className="mt-[40px] flex w-full items-center justify-center gap-[20px]">
        {transiton ? (
          <Loader />
        ) : (
          <ButtonBuilder
            htmlType="submit"
            classNames="text-white"
            type="normal"
          >
            {formType === "edit"
              ? "Save Changes"
              : formType == "own:edit"
                ? "Save"
                : "Create Task"}
          </ButtonBuilder>
        )}
      </div>
    </form>
  );
}
