"use client";

import { createTask, editTask } from "@/lib/actions/task.action";
import { getAllDepartments } from "@/lib/actions/department.action";
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
import { startTransition, useEffect, useMemo, useState, useTransition } from "react";
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
import { Client, Task } from "@/lib/types";
import Loader from "../Shared/Loader";

interface Props {
  formType: "edit" | "create" | "own:edit";
  currentTask?: Task;
  institutions?: Pick<Client, "id" | "institution">[] | undefined;
  onSuccess?: () => void;
  onCancel?: () => void;
}
type TaskKind = "client" | "general";

export default function TaskForm({
  formType,
  currentTask,
  institutions,
  onSuccess,
  onCancel,
}: Props) {
  const instituionId = currentTask ? currentTask.institutions[0] : undefined;

  const getDefaultInsitution = institutions?.find(
    (each) => each.id === instituionId?.id,
  );

  const isCreate = formType === "create";
  const formSchema = isCreate ? CreateTaskSchema : TaskSchema;
  type FormValues = z.infer<typeof formSchema>;

  const [taskKind, setTaskKind] = useState<TaskKind | null>(null);

  const {
    handleSubmit,
    register,
    setValue,
    reset,
    getValues,
    watch,
    setError,
    formState: { errors, touchedFields, submitCount },
  } = useForm<FormValues>({
    defaultValues: {
      taskKind: undefined,
      taskName: "",
      description: currentTask?.description ?? "",
      assigneeId: currentTask?.assignedTo.id ?? "",
      status: (currentTask?.status as TaskStatus) ?? TaskStatus.pending,
      clientInstitutionId: String(getDefaultInsitution?.id ?? ""),
      department: currentTask?.department ?? "",
      priority: currentTask?.priority
        ? (currentTask.priority.charAt(0).toUpperCase() +
            currentTask.priority.slice(1)) as TaskPriority
        : "Normal",
      supervisor: currentTask?.supervisor ?? "",
      deadline: currentTask?.deadline ? new Date(currentTask.deadline) : undefined,
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
    showBranchFields ? "task-form-branches" : null,
    getTaskFormBranchOptions,
  );
  const branchOptions = branchOptionsRes?.data?.branches ?? [];
  const singleBranch = branchOptionsRes?.data?.singleBranch ?? false;

  const editBranchId =
    currentTask?.assignedTo?.branchId != null
      ? String(currentTask.assignedTo.branchId)
      : "";

  const [selectedBranchId, setSelectedBranchId] = useState("");

  useEffect(() => {
    if (!showBranchFields) return;

    if (editBranchId) {
      setSelectedBranchId(editBranchId);
      return;
    }

    if (branchOptionsRes?.data?.defaultBranchId) {
      setSelectedBranchId(branchOptionsRes.data.defaultBranchId);
    }
  }, [showBranchFields, editBranchId, branchOptionsRes?.data?.defaultBranchId]);

  const { data: assigneesRes } = useSWR(
    selectedBranchId ? ["task-form-assignees", selectedBranchId, formType] : null,
    () =>
      getAllAssignees({
        branchId: selectedBranchId,
        ownAssigned: formType === "own:edit",
      }),
  );
  const assignees = assigneesRes?.data ?? [];

  const { data: departmentsRes } = useSWR(
    selectedBranchId ? [SWR_CACH_KEYS.departments.key, selectedBranchId, "task-form"] : null,
    () => getAllDepartments({ branchId: selectedBranchId, activeOnly: true }),
  );
  const departmentOptions = useMemo(
    () => departmentsRes?.data?.map((department) => department.name) ?? [],
    [departmentsRes?.data],
  );

  const selectedBranchName =
    branchOptions.find((branch) => branch.id === selectedBranchId)?.name ?? "";

  const { data: branchClientsRes } = useSWR(
    isCreate && selectedBranchId
      ? ["task-form-clients", selectedBranchId]
      : null,
    () => getTaskFormClientsByBranch(selectedBranchId),
  );
  const branchClients = branchClientsRes?.data ?? [];

  const deadlineValue = watch("deadline");

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
    if (session.data?.user?.department) {
      setValue("department", session.data.user.department, {
        shouldValidate: false,
      });
    }
  }

  const watchServiceInformation = watch("serviceInformation");
  const selectedClient = branchClients.find(
    (client) => client.id === watchInstitutionId,
  );
  const pendingServiceOptions = selectedClient?.pendingServices ?? [];
  const watchAssingneeId = watch("assigneeId");
  const currentUserId = session.data?.user.id;
  const isAssignee = String(currentUserId) === String(watchAssingneeId);

  const watchedDepartment = watch("department");
  const watchedPriority = watch("priority");
  const watchedStatus = watch("status");
  const watchedProgress = watch("progress");

  useEffect(() => {
    if (!isCreate || !session.data?.user?.department) return;
    if (!watchedDepartment) {
      setValue("department", session.data.user.department, {
        shouldValidate: false,
      });
    }
  }, [isCreate, session.data?.user?.department, watchedDepartment, setValue]);

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
      reset({
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
          : undefined,
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
    if (showBranchFields && !selectedBranchId) {
      toast.error("Please select a branch first");
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
          progress: 0,
          isPersonal: false,
        });
        if (result?.success) {
          toast.success("Successfully Created Task.");
          refreshTasksList();
          if (onSuccess) return onSuccess();
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
          taskId: currentTask?.id!,
          deadline: data.deadline,
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
          labelText="Select Branch"
          placeholder="Select branch first"
          value={selectedBranchName}
          disbaleSelect={transiton || singleBranch}
          compact={isModal}
          elementRenderer={() =>
            branchOptions.map((branch) => (
              <GetSelectItem key={branch.id} value={branch.name} label={branch.name} />
            ))
          }
          onChange={(value) => {
            const branch = branchOptions.find((item) => item.name === value);
            const nextBranchId = branch?.id ?? "";
            setSelectedBranchId(nextBranchId);
            setTaskKind(null);
            setValue("taskKind", undefined, { shouldValidate: false });
            setValue("assigneeId", "", { shouldValidate: false });
            setValue("clientInstitutionId", "", { shouldValidate: false });
            setValue("serviceInformation", "", { shouldValidate: false });
            setValue("taskName", "", { shouldValidate: false });
            setValue("description", "", { shouldValidate: false });
            if (isCreate && session.data?.user?.department) {
              setValue("department", session.data.user.department, {
                shouldValidate: false,
              });
            } else {
              setValue("department", "", { shouldValidate: false });
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
        placeholder={selectedBranchId ? "Select assignee" : "Select branch first"}
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
          const selectedUser = assignees.find((u) => String(u.id) === value);
          if (selectedUser?.department) {
            setValue("department", selectedUser.department, {
              shouldValidate: isCreate ? false : true,
            });
          }
        }}
      />
      <SelectElement
        labelText="Department"
        placeholder={
          selectedBranchId ? "Select department" : "Select branch first"
        }
        value={watchedDepartment}
        defaultValue={watchedDepartment}
        disbaleSelect={transiton || formType === "own:edit" || !selectedBranchId}
        errorMessage={fieldMessage("department")}
        invalid={fieldInvalid("department")}
        elements={departmentOptions}
        compact={isModal}
        onChange={(value) => {
          setValue("department", value, {
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
        labelText={isCreate ? "Due Date (optional)" : "Select Deadline"}
        disbaled={transiton || session.data?.user.role === "user"}
        date={deadlineValue}
        showTimePicker
        compact={isModal}
        setDate={(date) => {
          setValue("deadline", date, { shouldValidate: true });
        }}
        errorMessage={fieldMessage("deadline")}
        invalid={fieldInvalid("deadline")}
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
