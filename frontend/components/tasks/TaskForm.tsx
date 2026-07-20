"use client";

import { createTask, editTask } from "@/lib/actions/task.action";
import {
  getAllAssignees,
  getTaskFormBranchOptions,
  getTaskFormClientsByBranch,
} from "@/lib/actions/shared.action";
import { ROUTES, SWR_CACH_KEYS, TASK_PRIORITIES } from "@/lib/constants";
import { btnFormCancel, btnFormSubmit } from "@/lib/dashboard-ui";
import { cn, getTaskStatus } from "@/lib/utils";
import { CreateTaskSchema, TaskSchema } from "@/lib/validations";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import useSWR from "swr";
import { useSWRConfig } from "swr";
import { z } from "zod";
import ButtonBuilder from "../Shared/ButtonBuilder";
import { Button } from "../ui/button";

import {
  DatePicker,
  GetSelectItem,
  SelectElement,
  TextInput,
  TextInputWithTaxtArea,
} from "../Shared/FormElements";

import { authClient } from "@/lib/auth-client";
import { TaskPriority, TaskStatus } from "@/lib/schema";
import { Task } from "@/lib/types";
import Loader from "../Shared/Loader";

interface Props {
  formType: "edit" | "create" | "own:edit";
  currentTask?: Task;
  onSuccess?: () => void;
  onCancel?: () => void;
}
type TaskKind = "client" | "general";

function defaultDueDate() {
  const date = new Date();
  date.setHours(23, 59, 0, 0);
  return date;
}

function extraTimeDate(deadline?: Date, minutes = 0) {
  if (!deadline || minutes <= 0) return undefined;
  return new Date(deadline.getTime() + minutes * 60_000);
}

function formatExtraDuration(totalHours?: number) {
  const totalMinutes = Math.max(0, Math.round(Number(totalHours || 0) * 60));
  if (!totalMinutes) return "No extra time added";
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return [
    days ? `${days} day${days === 1 ? "" : "s"}` : "",
    hours ? `${hours} hour${hours === 1 ? "" : "s"}` : "",
    minutes ? `${minutes} minute${minutes === 1 ? "" : "s"}` : "",
  ].filter(Boolean).join(" ");
}

export default function TaskForm({
  formType,
  currentTask,
  onSuccess,
  onCancel,
}: Props) {
  const isCreate = formType === "create";
  const formSchema = isCreate ? CreateTaskSchema : TaskSchema;
  type FormValues = z.infer<typeof formSchema>;

  const hasClientInit = currentTask?.institutions && currentTask.institutions.length > 0;
  const [taskKind, setTaskKind] = useState<TaskKind | null>(
    currentTask ? (hasClientInit ? "client" : "general") : null
  );

  const {
    handleSubmit,
    register,
    setValue,
    reset,
    getValues,
    watch,
    formState: { errors, touchedFields, submitCount },
  } = useForm<FormValues>({
    defaultValues: {
      taskKind: currentTask ? (hasClientInit ? "client" : "general") : undefined,
      taskName: currentTask && !hasClientInit ? (currentTask.serviceInformation || "") : "",
      description: currentTask?.description ?? "",
      assigneeId: currentTask?.assignedTo.id ?? "",
      status: (currentTask?.status as TaskStatus) ?? TaskStatus.pending,
      clientInstitutionId: String(currentTask?.institutions?.[0]?.id || ""),
      department: currentTask?.department ?? "",
      priority: currentTask?.priority
        ? (currentTask.priority.charAt(0).toUpperCase() +
            currentTask.priority.slice(1)) as TaskPriority
        : "Normal",
      supervisor: currentTask?.supervisor ?? "",
      deadline: currentTask?.deadline ? new Date(currentTask.deadline) : defaultDueDate(),
      extraTimeHours: Number(currentTask?.extraTimeMinutes ?? 0) / 60,
      progress: currentTask?.progress || 0,
      serviceInformation: currentTask?.serviceInformation || "",
    },
    resolver: standardSchemaResolver(formSchema),
    mode: isCreate ? "onSubmit" : "onTouched",
    reValidateMode: "onChange",
  });

  function fieldInvalid(field: any) {
    if (isCreate) return submitCount > 0 && Boolean(errors[field as keyof typeof errors]);
    if (!touchedFields[field as keyof typeof touchedFields] && submitCount === 0) return false;
    return Boolean(errors[field as keyof typeof errors]);
  }

  function fieldMessage(field: any) {
    if (isCreate) return undefined;
    if (!touchedFields[field as keyof typeof touchedFields] && submitCount === 0) return undefined;
    return errors[field as keyof typeof errors]?.message;
  }

  const taskStatus = getTaskStatus(formType);
  const session = authClient.useSession();
  const showBranchFields = formType !== "own:edit";

  const { data: branchOptionsRes } = useSWR(
    showBranchFields ? "task-form-portfolios" : null,
    getTaskFormBranchOptions,
  );
  const branchOptions = branchOptionsRes?.data?.portfolios ?? [];
  const singleBranch = branchOptionsRes?.data?.singleBranch ?? false;

  const editBranchId =
    currentTask?.assignedTo?.portfolioId != null
      ? String(currentTask.assignedTo.portfolioId)
      : "";

  const [selectedBranchId, setSelectedBranchId] = useState(editBranchId);

  useEffect(() => {
    if (!showBranchFields) return;

    const availablePortfolios = branchOptionsRes?.data?.portfolios ?? [];
    const editBranchIsAvailable = availablePortfolios.some(
      (portfolio) => String(portfolio.id) === editBranchId,
    );

    if (editBranchId && editBranchIsAvailable) {
      setSelectedBranchId(editBranchId);
      return;
    }

    if (branchOptionsRes?.data?.defaultBranchId) {
      setSelectedBranchId(branchOptionsRes.data.defaultBranchId);
    }
  }, [showBranchFields, editBranchId, branchOptionsRes?.data]);

  const { data: assigneesRes } = useSWR(
    selectedBranchId ? ["task-form-assignees", selectedBranchId, formType] : null,
    () =>
      getAllAssignees({
        portfolioId: selectedBranchId,
        ownAssigned: formType === "own:edit",
      }),
  );
  const assignees = assigneesRes?.data ?? [];

  const selectedBranchName =
    branchOptions.find((portfolio) => String(portfolio.id) === String(selectedBranchId))?.name ?? "";

  const { data: branchClientsRes } = useSWR(
    isCreate && selectedBranchId
      ? ["task-form-clients", selectedBranchId]
      : null,
    () => getTaskFormClientsByBranch(selectedBranchId),
  );
  const branchClients = branchClientsRes?.data ?? [];

  const deadlineValue = watch("deadline");
  const extraTimeHoursValue = watch("extraTimeHours");
  const [extraTimeUntil, setExtraTimeUntil] = useState<Date | undefined>(() =>
    extraTimeDate(
      currentTask?.deadline ? new Date(currentTask.deadline) : undefined,
      Number(currentTask?.extraTimeMinutes ?? 0),
    ),
  );

  const [transiton, setStartTransition] = useTransition();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const isModal = Boolean(onSuccess || onCancel);

  const watchInstitutionId = watch("clientInstitutionId");
  const watchTaskName = watch("taskName");

  function handleTaskKindChange(kind: TaskKind) {
    setTaskKind(kind);
    setValue("taskKind", kind, { shouldValidate: false });
    setValue("clientInstitutionId", "", { shouldValidate: false });
    setValue("serviceInformation", "", { shouldValidate: false });
    setValue("taskName", "", { shouldValidate: false });
    setValue("description", "", { shouldValidate: false });
    setValue("assigneeId", "", { shouldValidate: false });
  }

  const watchServiceInformation = watch("serviceInformation");
  const selectedClient = branchClients.find(
    (client) => client.id === watchInstitutionId,
  );
  const pendingServiceOptions = selectedClient?.pendingServices ?? [];
  const watchAssingneeId = watch("assigneeId");
  const currentUserId = session.data?.user.id;
  const isAssignee = String(currentUserId) === String(watchAssingneeId);

  const watchedPriority = watch("priority");
  const watchedStatus = watch("status");
  const watchedProgress = watch("progress");

  useEffect(() => {
    if (!isCreate) return;
    setValue("status", TaskStatus.pending, { shouldValidate: false });
    setValue("progress", 0, { shouldValidate: false });
  }, [isCreate, setValue]);

  useEffect(() => {
    if (formType === "create") return;
    if (watchedStatus === TaskStatus.completed) {
      setValue("progress", 100, { shouldValidate: true });
    }
  }, [formType, watchedStatus, setValue]);

  useEffect(() => {
    if (formType === "create") return;
    if (Number(watchedProgress) >= 100) {
      setValue("status", TaskStatus.completed, { shouldValidate: true });
    }
  }, [formType, watchedProgress, setValue]);

  useEffect(() => {
    if (currentTask) {
      const currentDeadline = currentTask.deadline ? new Date(currentTask.deadline) : defaultDueDate();
      setExtraTimeUntil(extraTimeDate(currentDeadline, Number(currentTask.extraTimeMinutes ?? 0)));
      const isClient = currentTask.institutions && currentTask.institutions.length > 0;
      setTaskKind(isClient ? "client" : "general");
      reset({
        taskKind: isClient ? "client" : "general",
        taskName: !isClient ? (currentTask.serviceInformation || "") : "",
        description: currentTask.description,
        assigneeId: currentTask.assignedTo.id,
        status: currentTask.status.toLowerCase() as TaskStatus,
        clientInstitutionId: String(currentTask.institutions[0]?.id || ""),
        department: currentTask.department,
        priority: (currentTask.priority.charAt(0).toUpperCase() +
          currentTask.priority.slice(1)) as TaskPriority,
        supervisor: currentTask.supervisor,
        deadline: currentTask.deadline
          ? new Date(currentTask.deadline)
          : defaultDueDate(),
        extraTimeHours: Number(currentTask.extraTimeMinutes ?? 0) / 60,
        progress: currentTask.progress || 0,
        serviceInformation: currentTask.serviceInformation || "",
      });
    }
  }, [currentTask, reset]);

  function refreshTasksList() {
    mutate(SWR_CACH_KEYS.tasks.key);
    mutate(SWR_CACH_KEYS.myTasks.key);
  }

  function handleSubmitForm(data: FormValues) {
    const taskId = currentTask?.id;
    if (!isCreate && !taskId) {
      toast.error("Task data is not loaded yet");
      return;
    }

    if (showBranchFields && !selectedBranchId) {
      toast.error("Please select a portfolio first");
      return;
    }

    if (formType === "create") {
      const createData = data as z.infer<typeof CreateTaskSchema>;
      const isGeneral = createData.taskKind === "general";
      setStartTransition(async () => {
        const result = await createTask({
          clientId: isGeneral ? undefined : createData.clientInstitutionId,
          serviceInformation: isGeneral
            ? createData.taskName
            : createData.serviceInformation,
          assgineeId: createData.assigneeId,
          description: createData.description,
          status: TaskStatus.pending,
          department: createData.department,
          priority: createData.priority,
          supervisor: createData.supervisor?.trim() || "",
          deadline: createData.deadline ?? null,
          extraTimeMinutes: Math.round(Number(createData.extraTimeHours ?? 0) * 60),
          progress: 0,
          isPersonal: false,
        });
        if (result?.success) {
          toast.success("Successfully Created Task.");
          refreshTasksList();
          // Reset form state so next creation starts clean
          reset({
            taskKind: undefined,
            taskName: "",
            description: "",
            assigneeId: "",
            status: TaskStatus.pending,
            clientInstitutionId: "",
            department: "",
            priority: "Normal" as TaskPriority,
            supervisor: "",
            deadline: defaultDueDate(),
            extraTimeHours: 0,
            progress: 0,
            serviceInformation: "",
          });
          setExtraTimeUntil(undefined);
          setTaskKind(null);
          if (onSuccess) return onSuccess();
          return router.push(ROUTES.tasks);
        }
        toast.error(result?.errors?.message || "Failed to created Task");
      });
    } else if (formType === "edit") {
      startTransition(async () => {
        const result = await editTask({
          taskId,
          deadline: data.deadline,
          extraTimeMinutes: Math.round(Number(data.extraTimeHours ?? 0) * 60),
          status: data.status,
          assgineeId: data.assigneeId,
          description: data.description,
          department: data.department,
          priority: data.priority,
          supervisor: data.supervisor,
          progress: data.progress,
          serviceInformation: data.serviceInformation,
        });
        if (result.success) {
          toast.success("Successfully Edited Task");
          refreshTasksList();
          if (onSuccess) return onSuccess();
          return router.push(ROUTES.tasks);
        }
        toast.error(result.errors?.message || "OOh! Failed to edit the task");
      });
    } else if (formType === "own:edit") {
      startTransition(async () => {
        const result = await editTask({
          ownEdit: true,
          taskId,
          deadline: data.deadline,
          extraTimeMinutes: Math.round(Number(data.extraTimeHours ?? 0) * 60),
          status: data.status,
          assgineeId: data.assigneeId,
          description: data.description,
          department: data.department,
          priority: data.priority,
          supervisor: data.supervisor,
          progress: data.progress,
          serviceInformation: data.serviceInformation,
        });
        if (result.success) {
          toast.success("Successfully Edited Task");
          refreshTasksList();
          if (onSuccess) return onSuccess();
          return router.push(ROUTES.tasks);
        }
        toast.error(result.errors?.message || "OOh! Failed to edit the task");
      });
    }
  }

  return (
    <form
      onSubmit={handleSubmit(handleSubmitForm)}
      className={cn(
        "flex w-full flex-col",
        isModal ? "min-h-0 flex-1 overflow-hidden" : "flex-wrap gap-[20px]",
      )}
    >
      <div
        className={cn(
          "flex w-full flex-col",
          isModal
            ? "min-h-0 flex-1 gap-4 overflow-y-auto px-6 pt-5"
            : "flex-wrap gap-[20px]",
        )}
      >
      {showBranchFields && (
        <SelectElement
          labelText="Select Portfolio"
          placeholder="Select portfolio first"
          value={selectedBranchName}
          disbaleSelect={transiton || singleBranch}
          compact={isModal}
          elementRenderer={() =>
            branchOptions.map((portfolio) => (
              <GetSelectItem key={portfolio.id} value={portfolio.name} label={portfolio.name} />
            ))
          }
          onChange={(value) => {
            const portfolio = branchOptions.find((item) => item.name === value);
            const nextBranchId = portfolio?.id ?? "";
            if (String(nextBranchId) === String(selectedBranchId)) return;
            setSelectedBranchId(nextBranchId);
            setValue("assigneeId", "", { shouldValidate: false });
            if (isCreate) {
              setTaskKind(null);
              setValue("taskKind", undefined, { shouldValidate: false });
              setValue("clientInstitutionId", "", { shouldValidate: false });
              setValue("serviceInformation", "", { shouldValidate: false });
              setValue("taskName", "", { shouldValidate: false });
            }
          }}
        />
      )}

      {isCreate && selectedBranchId && (
        <div className="w-full max-w-[min(800px,100%)] space-y-3">
          <p className="text-sm font-medium text-zinc-700">Task type</p>
          <div
            className={cn(
              "flex flex-wrap gap-2 rounded-md",
              fieldInvalid("taskKind") && "ring-2 ring-red-500",
            )}
          >
            <Button
              type="button"
              variant={taskKind === "client" ? "default" : "outline"}
              className="h-9"
              onClick={() => handleTaskKindChange("client")}
            >
              Client task
            </Button>
            <Button
              type="button"
              variant={taskKind === "general" ? "default" : "outline"}
              className="h-9"
              onClick={() => handleTaskKindChange("general")}
            >
              General task
            </Button>
          </div>
        </div>
      )}

      {isCreate && taskKind === "client" && (
        <>
          <SelectElement
            labelText="Select Client"
            placeholder={
              branchClients.length
                ? "Select client"
                : "No clients with pending services"
            }
            defaultValue={watchInstitutionId}
            disbaleSelect={transiton || !branchClients.length}
            errorMessage={fieldMessage("clientInstitutionId")}
            invalid={fieldInvalid("clientInstitutionId")}
            compact={isModal}
            elementRenderer={() =>
              branchClients.map(({ institution, id }) => (
                <GetSelectItem
                  key={id}
                  value={String(id)}
                  label={institution}
                />
              ))
            }
            onChange={(value) => {
              setValue("clientInstitutionId", value, {
                shouldValidate: true,
                shouldTouch: true,
              });
              setValue("serviceInformation", "", { shouldValidate: false });
            }}
          />
          <SelectElement
            labelText="Select Service"
            placeholder={
              watchInstitutionId
                ? pendingServiceOptions.length
                  ? "Select pending service"
                  : "No pending services"
                : "Select client first"
            }
            value={watchServiceInformation}
            defaultValue={watchServiceInformation}
            disbaleSelect={
              transiton || !watchInstitutionId || !pendingServiceOptions.length
            }
            errorMessage={fieldMessage("serviceInformation")}
            invalid={fieldInvalid("serviceInformation")}
            compact={isModal}
            elementRenderer={() =>
              pendingServiceOptions.map((service) => (
                <GetSelectItem
                  key={service.agreementId}
                  value={service.label}
                  label={service.label}
                />
              ))
            }
            onChange={(value) => {
              setValue("serviceInformation", value, {
                shouldValidate: true,
                shouldTouch: true,
              });
            }}
          />
        </>
      )}

      {isCreate && taskKind === "general" && (
        <TextInput
          labelId="taskName"
          labelText="Task Name"
          placeholder="Enter task name"
          defaultValue={watchTaskName}
          otherProps={{ ...register("taskName") }}
          disbaled={transiton}
          errorMessage={fieldMessage("taskName")}
          invalid={fieldInvalid("taskName")}
          compact={isModal}
        />
      )}

      {!isCreate && (
        <TextInput
          labelId="serviceInformation"
          labelText="Service Information"
          placeholder="Enter service information"
          defaultValue={currentTask?.serviceInformation}
          otherProps={{ ...register("serviceInformation") }}
          disbaled={transiton || formType === "own:edit"}
          errorMessage={fieldMessage("serviceInformation")}
          invalid={fieldInvalid("serviceInformation")}
          compact={isModal}
        />
      )}

      {(!isCreate || taskKind) && (
        <>
      <SelectElement
        labelText="Select Assignee"
        placeholder={selectedBranchId ? "Select assignee" : "Select portfolio first"}
        defaultValue={watchAssingneeId}
        disbaleSelect={transiton || formType === "own:edit" || !selectedBranchId}
        errorMessage={fieldMessage("assigneeId")}
        invalid={fieldInvalid("assigneeId")}
        compact={isModal}
        elementRenderer={() => {
          return assignees.map(({ name, id, role }) => {
            const label = role ? `${name} (${role})` : name;
            return (
              <GetSelectItem key={id} value={String(id)} label={label} />
            );
          });
        }}
        onChange={(value) => {
          setValue("assigneeId", value, {
            shouldValidate: true,
            shouldTouch: true,
          });
        }}
      />
      <SelectElement
        labelText="Priority"
        placeholder="Select priority"
        value={watchedPriority}
        defaultValue={watchedPriority}
        disbaleSelect={transiton || formType === "own:edit"}
        errorMessage={fieldMessage("priority")}
        invalid={fieldInvalid("priority")}
        compact={isModal}
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
          setValue("priority", value as TaskPriority, {
            shouldValidate: true,
            shouldTouch: true,
          });
        }}
      />
      <TextInput
        labelId="supervisor"
        labelText="Supervisor (optional)"
        placeholder="Enter supervisor name"
        defaultValue={getValues("supervisor")}
        otherProps={{ ...register("supervisor") }}
        disbaled={transiton || formType === "own:edit"}
        errorMessage={fieldMessage("supervisor")}
        invalid={fieldInvalid("supervisor")}
        compact={isModal}
      />
      {!isCreate && (
      <SelectElement
        disbaleSelect={transiton || formType === "own:edit"}
        labelText="Select Task Status"
        placeholder="Select Status"
        value={watchedStatus}
        defaultValue={watchedStatus}
        errorMessage={fieldMessage("status")}
        invalid={fieldInvalid("status")}
        elements={taskStatus}
        compact={isModal}
        onChange={(value) => {
          setValue("status", value as TaskStatus, { shouldValidate: true });
        }}
      />
      )}
      <TextInputWithTaxtArea
        labelId="title"
        labelText="Description"
        placeholder={
          isCreate && taskKind === "general"
            ? "Write the full task details here"
            : "Write the task description here"
        }
        defaultValue={currentTask?.description}
        otherProps={{ ...register("description") }}
        disbaled={transiton || formType === "own:edit"}
        errorMessage={fieldMessage("description")}
        invalid={fieldInvalid("description")}
        wrapperStyle={
          isCreate && taskKind === "general" ? "min-h-[160px]" : "h-fit"
        }
        compact={isModal}
      />

      <DatePicker
        labelText="Due Date"
        disbaled={transiton || session.data?.user.role === "user"}
        date={deadlineValue}
        showTimePicker
        compact={isModal}
        setDate={(date) => {
          setValue("deadline", date, { shouldValidate: true });
          const extraMinutes = Math.round(Number(extraTimeHoursValue ?? 0) * 60);
          setExtraTimeUntil(extraTimeDate(date, extraMinutes));
        }}
        errorMessage={fieldMessage("deadline")}
        invalid={fieldInvalid("deadline")}
      />

      <DatePicker
        labelText="Extra Time Until (optional)"
        disbaled={transiton || formType === "own:edit" || session.data?.user.role === "user"}
        date={extraTimeUntil}
        showTimePicker
        compact={isModal}
        setDate={(date) => {
          const dueDate = getValues("deadline") ?? defaultDueDate();
          if (!getValues("deadline")) setValue("deadline", dueDate, { shouldValidate: true });
          const minutes = Math.max(0, Math.round((date.getTime() - dueDate.getTime()) / 60_000));
          setExtraTimeUntil(date.getTime() < dueDate.getTime() ? dueDate : date);
          setValue("extraTimeHours", minutes / 60, { shouldValidate: true });
        }}
      />

      <TextInput
        labelId="calculatedExtraTime"
        labelText="Calculated Extra Time"
        placeholder="No extra time added"
        type="text"
        otherProps={{ value: formatExtraDuration(extraTimeHoursValue), readOnly: true }}
        disbaled={false}
        inputStyle="bg-zinc-50 font-semibold text-slate-700"
        compact={isModal}
      />
      {!isCreate && (
      <TextInput
        labelId="progress"
        labelText="Completion Percentage (%)"
        placeholder="Enter percentage (0-100)"
        type="number"
        defaultValue={String(getValues("progress"))}
        otherProps={{ ...register("progress", { valueAsNumber: true }) }}
        disbaled={!isAssignee || transiton}
        errorMessage={fieldMessage("progress")}
        invalid={fieldInvalid("progress")}
        compact={isModal}
      />
      )}
      {!isCreate && !isAssignee && session.data?.user.role !== "user" && (
        <p className="text-xs font-medium text-zinc-400">
          Only the assigned user can update the progress.
        </p>
      )}
        </>
      )}

      </div>

      <div
        className={cn(
          "flex w-full flex-row items-center gap-3",
          isModal
            ? "shrink-0 justify-end border-t border-zinc-100 bg-white px-6 py-4"
            : "mt-10 justify-center",
        )}
      >
        {transiton ? (
          <Loader />
        ) : (
          <>
            {isModal && onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className={btnFormCancel}
              >
                Cancel
              </Button>
            )}
            {isModal ? (
              <Button type="submit" className={btnFormSubmit}>
                {formType === "edit" ? "Save" : "Add"}
              </Button>
            ) : (
              <ButtonBuilder htmlType="submit" classNames="text-white" type="normal">
                {formType === "edit"
                  ? "Save Changes"
                  : formType == "own:edit"
                    ? "Save"
                    : "Create Task"}
              </ButtonBuilder>
            )}
          </>
        )}
      </div>
    </form>
  );
}
