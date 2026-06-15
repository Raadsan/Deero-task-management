"use client";

import { createTask, editTask } from "@/lib/actions/task.action";
import { getAllDepartments } from "@/lib/actions/department.action";
import {
  getAllAssignees,
  getTaskFormBranchOptions,
} from "@/lib/actions/shared.action";
import { ROUTES, SWR_CACH_KEYS, TASK_PRIORITIES } from "@/lib/constants";
import { btnFormCancel, btnFormSubmit } from "@/lib/dashboard-ui";
import { cn, getTaskStatus } from "@/lib/utils";
import { TaskSchema } from "@/lib/validations";
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
      serviceInformation: currentTask?.serviceInformation || "",
    },
    resolver: standardSchemaResolver(TaskSchema),
  });

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

  const deadlineValue = watch("deadline");

  const [transiton, setStartTransition] = useTransition();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const isModal = Boolean(onSuccess || onCancel);

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
  const watchedProgress = watch("progress");

  useEffect(() => {
    if (watchedStatus === TaskStatus.completed) {
      setValue("progress", 100, { shouldValidate: true });
    }
  }, [watchedStatus, setValue]);

  useEffect(() => {
    if (Number(watchedProgress) >= 100) {
      setValue("status", TaskStatus.completed, { shouldValidate: true });
    }
  }, [watchedProgress, setValue]);

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
        serviceInformation: currentTask.serviceInformation || "",
      });
    }
  }, [currentTask, reset]);

  function refreshTasksList() {
    mutate(SWR_CACH_KEYS.tasks.key);
    mutate(SWR_CACH_KEYS.myTasks.key);
  }

  function handleSubmitForm(data: z.infer<typeof TaskSchema>) {
    if (showBranchFields && !selectedBranchId) {
      toast.error("Please select a branch first");
      return;
    }

    if (formType === "create") {
      setStartTransition(async () => {
        const result = await createTask({
          clientId: data.clientInstitutionId,
          serviceInformation: data.serviceInformation,
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
            setValue("assigneeId", "", { shouldValidate: true });
            setValue("department", "", { shouldValidate: true });
          }}
        />
      )}

      {formType === "create" && (
        <SelectElement
          labelText="Select Client"
          placeholder="Select Client Institution"
          defaultValue={watchInstitutionId}
          disbaleSelect={transiton}
          errorMessage={errors.clientInstitutionId?.message}
          compact={isModal}
          elementRenderer={() => {
            return institutions?.map(({ institution, id }) => (
              <GetSelectItem
                key={id}
                value={String(id)}
                label={institution}
              />
            ));
          }}
          onChange={(value) => {
            setValue("clientInstitutionId", value, { shouldValidate: true });
          }}
        />
      )}

      <TextInput
        labelId="serviceInformation"
        labelText="Service Information"
        placeholder="Enter service information"
        defaultValue={currentTask?.serviceInformation}
        otherProps={{ ...register("serviceInformation") }}
        disbaled={transiton || formType === "own:edit"}
        errorMessage={errors.serviceInformation?.message}
        compact={isModal}
      />

      <SelectElement
        labelText="Select Assignee"
        placeholder={selectedBranchId ? "Select assignee" : "Select branch first"}
        defaultValue={watchAssingneeId}
        disbaleSelect={transiton || formType === "own:edit" || !selectedBranchId}
        errorMessage={errors.assigneeId?.message}
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
          setValue("assigneeId", value, { shouldValidate: true });
          const selectedUser = assignees.find((u) => String(u.id) === value);
          if (selectedUser?.department) {
            setValue("department", selectedUser.department, {
              shouldValidate: true,
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
        errorMessage={errors.department?.message}
        elements={departmentOptions}
        compact={isModal}
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
        compact={isModal}
      />
      <SelectElement
        disbaleSelect={transiton}
        labelText="Select Task Status"
        placeholder="Select Status"
        value={watchedStatus}
        defaultValue={watchedStatus}
        errorMessage={errors.status?.message}
        elements={taskStatus}
        compact={isModal}
        onChange={(value) => {
          setValue("status", value as TaskStatus, { shouldValidate: true });
        }}
      />
      <DatePicker
        labelText="Select Deadline"
        disbaled={transiton || session.data?.user.role === "user"}
        date={deadlineValue}
        showTimePicker
        compact={isModal}
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
        compact={isModal}
      />
      {!isAssignee && session.data?.user.role !== "user" && (
        <p className="text-xs font-medium text-zinc-400">
          Only the assigned user can update the progress.
        </p>
      )}

      <TextInputWithTaxtArea
        labelId="title"
        labelText="Subject/Description"
        placeholder="Write the subject here"
        defaultValue={currentTask?.description}
        otherProps={{ ...register("description") }}
        disbaled={transiton || formType === "own:edit"}
        errorMessage={errors.description?.message}
        wrapperStyle="h-fit"
        compact={isModal}
      />
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
