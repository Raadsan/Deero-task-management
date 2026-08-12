"use client";

import { createTask, editTask } from "@/lib/apis/taskApi";
import {
  getAllAssignees,
  getTaskFormBranchOptions,
  getTaskFormClientsByBranch,
} from "@/lib/apis/sharedApi";
import { ROUTES, SWR_CACH_KEYS, TASK_PRIORITIES } from "@/lib/constants";
import { btnFormCancel, btnFormSubmit } from "@/lib/dashboard-ui";
import { cn, getTaskStatus, resolveTaskDisplayStatus } from "@/lib/utils";
import { ArrowRightLeft, CheckSquare, Clock, Lock, Plus, UserCheck, Users, X } from "lucide-react";
import { CreateTaskSchema, TaskSchema } from "@/lib/validations";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState, useTransition, useMemo } from "react";
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
  initialData?: any;
  onSuccess?: () => void;
  onCancel?: () => void;
}
type TaskKind = "client" | "general";

function defaultDueDate() {
  return new Date(); // defaults to right now (current time)
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
  initialData,
  onSuccess,
  onCancel,
}: Props) {
  const isCreate = formType === "create";
  const formSchema = isCreate ? CreateTaskSchema : TaskSchema;
  type FormValues = z.infer<typeof formSchema>;

  const hasClientInit = currentTask?.institutions && currentTask.institutions.length > 0;
  const initialKind =
    initialData?.taskKind ??
    (currentTask ? (hasClientInit ? "client" : "general") : (initialData?.clientInstitutionId ? "client" : null));

  const [taskKind, setTaskKind] = useState<TaskKind | null>(initialKind);
  const [taskFeatures, setTaskFeatures] = useState<Array<{ id: string; name: string; done: boolean }>>([]);

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
      taskKind: initialKind ?? undefined,
      taskName: currentTask && !hasClientInit ? (currentTask.serviceInformation || "") : "",
      description: initialData?.description ?? currentTask?.description ?? "",
      assigneeId: initialData?.assigneeId ?? currentTask?.assignedTo?.id ?? "",
      status: (currentTask?.status as TaskStatus) ?? TaskStatus.pending,
      clientInstitutionId: String(initialData?.clientInstitutionId ?? currentTask?.institutions?.[0]?.id ?? ""),
      department: initialData?.department ?? currentTask?.department ?? "",
      priority: currentTask?.priority
        ? (currentTask.priority.charAt(0).toUpperCase() +
          currentTask.priority.slice(1)) as TaskPriority
        : "Normal",
      supervisor: currentTask?.supervisor ?? "",
      startDate: initialData?.startDate
        ? new Date(initialData.startDate)
        : currentTask?.startDate
          ? new Date(currentTask.startDate)
          : defaultDueDate(),
      deadline: initialData?.deadline
        ? new Date(initialData.deadline)
        : currentTask?.deadline
          ? new Date(currentTask.deadline)
          : defaultDueDate(),
      extraTimeHours: Number(currentTask?.extraTimeMinutes ?? 0) / 60,
      progress: currentTask?.progress || 0,
      serviceInformation: initialData?.serviceInformation ?? currentTask?.serviceInformation ?? "",
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
      : (currentTask as any)?.user?.portfolioId != null
        ? String((currentTask as any).user.portfolioId)
        : (currentTask as any)?.portfolioId != null
          ? String((currentTask as any).portfolioId)
          : "";

  const defaultBranchId = branchOptionsRes?.data?.defaultBranchId ?? "";
  const [selectedBranchId, setSelectedBranchId] = useState(() => editBranchId || (isCreate ? defaultBranchId : ""));

  // Auto-select the user's portfolio as soon as branch options are available
  useEffect(() => {
    if (!showBranchFields) return;

    const availablePortfolios = branchOptionsRes?.data?.portfolios ?? [];
    if (!availablePortfolios.length) return;

    const editBranchIsAvailable = availablePortfolios.some(
      (portfolio) => String(portfolio.id) === editBranchId,
    );

    if (editBranchId && editBranchIsAvailable) {
      setSelectedBranchId(editBranchId);
      return;
    }

    const defaultId = branchOptionsRes?.data?.defaultBranchId;
    if (defaultId) {
      const isCurrentValid = availablePortfolios.some(
        (portfolio) => String(portfolio.id) === String(selectedBranchId),
      );
      if (!selectedBranchId || !isCurrentValid) {
        setSelectedBranchId(defaultId);
      }
    }
  }, [showBranchFields, editBranchId, branchOptionsRes?.data, selectedBranchId]);

  const { data: assigneesRes } = useSWR(
    selectedBranchId ? ["task-form-assignees", selectedBranchId, formType] : null,
    () =>
      getAllAssignees({
        portfolioId: selectedBranchId,
        ownAssigned: formType === "own:edit",
      }),
  );
  const EMPTY_ASSIGNEES = useMemo(() => [], []);
  const assignees = assigneesRes?.data ?? EMPTY_ASSIGNEES;

  const selectedBranchName =
    branchOptions.find((portfolio) => String(portfolio.id) === String(selectedBranchId))?.name ?? "";

  const { data: branchClientsRes } = useSWR(
    isCreate && selectedBranchId
      ? ["task-form-clients", selectedBranchId]
      : null,
    () => getTaskFormClientsByBranch(selectedBranchId),
  );
  const branchClients = branchClientsRes?.data ?? [];
  const EMPTY_PENDING_SERVICES = useMemo(() => [], []);

  const currentUserId = session.data?.user?.id;

  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>(() => {
    if (currentTask?.assignedTo?.id) return [String(currentTask.assignedTo.id)];
    if (initialData?.assigneeId) return [String(initialData.assigneeId)];
    return [];
  });

  const startDateValue = watch("startDate");
  const deadlineValue = watch("deadline");
  const extraTimeHoursValue = watch("extraTimeHours");
  const [extraTimeUntil, setExtraTimeUntil] = useState<Date | undefined>(() =>
    extraTimeDate(
      currentTask?.deadline ? new Date(currentTask.deadline) : undefined,
      Number(currentTask?.extraTimeMinutes ?? 0),
    ),
  );

  function toggleAssignee(id: string) {
    const targetId = String(id);
    setSelectedAssigneeIds((prev) => {
      let next: string[];
      if (prev.includes(targetId)) {
        next = prev.filter((i) => i !== targetId);
      } else {
        next = [...prev, targetId];
      }
      setValue("assigneeId", next[0] || "", { shouldValidate: true });
      return next;
    });
  }

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
  const pendingServiceOptions = selectedClient?.pendingServices ?? EMPTY_PENDING_SERVICES;
  const watchAssingneeId = watch("assigneeId");
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
      if (getValues("progress") !== 100) {
        setValue("progress", 100, { shouldValidate: true });
      }
    }
  }, [formType, watchedStatus, setValue, getValues]);

  useEffect(() => {
    if (formType === "create") return;
    if (Number(watchedProgress) >= 100) {
      if (getValues("status") !== TaskStatus.completed) {
        setValue("status", TaskStatus.completed, { shouldValidate: true });
      }
    }
  }, [formType, watchedProgress, setValue, getValues]);

  useEffect(() => {
    if (!isCreate) return;
    if (!watchInstitutionId || !pendingServiceOptions.length) return;

    const currentVal = getValues("serviceInformation");
    const exactMatch = pendingServiceOptions.find((s) => s.label === currentVal);

    if (!currentVal || !exactMatch) {
      const searchTarget = (initialData?.serviceInformation || "").toLowerCase();
      const partialMatch = pendingServiceOptions.find(
        (s) =>
          (searchTarget && s.label.toLowerCase().includes(searchTarget)) ||
          (searchTarget && s.serviceName.toLowerCase().includes(searchTarget)) ||
          (searchTarget && searchTarget.includes(s.serviceName.toLowerCase())),
      );

      const autoSelected = partialMatch ? partialMatch.label : pendingServiceOptions[0].label;
      setValue("serviceInformation", autoSelected, {
        shouldValidate: true,
        shouldTouch: true,
      });
    }
  }, [isCreate, watchInstitutionId, pendingServiceOptions, initialData, getValues, setValue]);

  useEffect(() => {
    if (!isCreate) return;
    if (!watchServiceInformation || !pendingServiceOptions.length) {
      if (taskFeatures.length > 0) {
        setTaskFeatures([]);
      }
      return;
    }
    const matchedService = pendingServiceOptions.find(
      (s) => s.label === watchServiceInformation,
    );
    if (matchedService?.features?.length) {
      setTaskFeatures(
        matchedService.features.map((f, i) => ({
          id: String(i),
          name: f,
          done: false,
        })),
      );
    } else {
      if (taskFeatures.length > 0) {
        setTaskFeatures([]);
      }
    }
  }, [isCreate, watchServiceInformation, pendingServiceOptions]);

  useEffect(() => {
    if (currentTask?.features && Array.isArray(currentTask.features)) {
      setTaskFeatures(
        currentTask.features.map((f: any, i: number) => ({
          id: String(f.id ?? i),
          name: f.name ?? String(f),
          done: Boolean(f.done || f.completed),
        })),
      );
    }
  }, [currentTask]);

  function toggleFeatureDone(index: number, isDone: boolean) {
    const updated = [...taskFeatures];
    updated[index] = { ...updated[index], done: isDone };
    setTaskFeatures(updated);

    if (updated.length > 0) {
      const doneCount = updated.filter((f) => f.done).length;
      const newProgress = Math.round((doneCount / updated.length) * 100);
      setValue("progress", newProgress, { shouldValidate: true });
      if (newProgress === 100) {
        setValue("status", TaskStatus.completed, { shouldValidate: true });
      } else if (newProgress > 0 && watchedStatus !== TaskStatus.completed) {
        setValue("status", TaskStatus.pending, { shouldValidate: true });
      }
    }
  }

  useEffect(() => {
    if (currentTask) {
      const currentDeadline = currentTask.deadline ? new Date(currentTask.deadline) : defaultDueDate();
      setExtraTimeUntil(extraTimeDate(currentDeadline, Number(currentTask.extraTimeMinutes ?? 0)));
      const isClient = currentTask.institutions && currentTask.institutions.length > 0;
      const targetAssigneeId = String(
        currentTask.assignedTo?.id ??
        (currentTask as any)?.assgineeId ??
        (currentTask as any)?.user?.id ??
        "",
      );
      
      const siblingIds = (currentTask as any).siblings?.map((s: any) => String(s.assgineeId)) || [targetAssigneeId];
      setSelectedAssigneeIds(siblingIds);

      setTaskKind(isClient ? "client" : "general");
      reset({
        taskKind: isClient ? "client" : "general",
        taskName: !isClient ? (currentTask.serviceInformation || "") : "",
        description: currentTask.description,
        assigneeId: targetAssigneeId,
        status: currentTask.status.toLowerCase() as TaskStatus,
        clientInstitutionId: String(currentTask.institutions?.[0]?.id || ""),
        department: currentTask.department,
        priority: (currentTask.priority.charAt(0).toUpperCase() +
          currentTask.priority.slice(1)) as TaskPriority,
        supervisor: currentTask.supervisor,
        startDate: currentTask.startDate ? new Date(currentTask.startDate) : defaultDueDate(),
        deadline: currentTask.deadline
          ? new Date(currentTask.deadline)
          : defaultDueDate(),
        extraTimeHours: Number(currentTask.extraTimeMinutes ?? 0) / 60,
        progress: currentTask.progress || 0,
        serviceInformation: currentTask.serviceInformation || "",
      });
    }
  }, [currentTask, reset]);

  useEffect(() => {
    if (!isCreate && currentTask) {
      const targetAssigneeId = String(
        currentTask.assignedTo?.id ??
        (currentTask as any)?.assgineeId ??
        (currentTask as any)?.user?.id ??
        "",
      );
      if (targetAssigneeId && getValues("assigneeId") !== targetAssigneeId) {
        setValue("assigneeId", targetAssigneeId, { shouldValidate: true });
      }
    }
  }, [isCreate, currentTask, assignees, getValues, setValue]);

  function refreshTasksList() {
    mutate(SWR_CACH_KEYS.tasks.key);
    mutate(SWR_CACH_KEYS.myTasks.key);
    mutate(SWR_CACH_KEYS.myTasksList.key);
    mutate(SWR_CACH_KEYS.myTasksToday.key);
    mutate(SWR_CACH_KEYS.myTasksBoard.key);
    mutate(
      (key) =>
        (typeof key === "string" && (key.includes("dashboard") || key.includes("task"))) ||
        (Array.isArray(key) && (String(key[0]).includes("dashboard") || String(key[0]).includes("task"))),
      undefined,
      { revalidate: true },
    );
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
      const targetAssignees = selectedAssigneeIds.length > 0 ? selectedAssigneeIds : [createData.assigneeId];
      setStartTransition(async () => {
          const clientObj = branchClients.find((c) => String(c.id) === String(createData.clientInstitutionId));
          const clientName = clientObj?.institution ?? "";
          const taskOrService = createData.taskName
            ? (createData.serviceInformation ? `${createData.serviceInformation} - ${createData.taskName}` : createData.taskName)
            : (createData.serviceInformation || "");
          const finalServiceInfo = isGeneral
            ? createData.taskName
            : (clientName ? `${clientName} - ${taskOrService}` : taskOrService);

          const result = await createTask({
            clientId: isGeneral ? undefined : createData.clientInstitutionId,
            serviceInformation: finalServiceInfo,
          assgineeId: targetAssignees[0],
          assigneeIds: targetAssignees,
          description: createData.description,
          status: TaskStatus.pending,
          department: createData.department,
          priority: createData.priority,
          supervisor: createData.supervisor?.trim() || "",
          startDate: createData.startDate ?? null,
          deadline: createData.deadline ?? null,
          extraTimeMinutes: Math.round(Number(createData.extraTimeHours ?? 0) * 60),
          progress: 0,
          isPersonal: false,
          features: taskFeatures,
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
            startDate: defaultDueDate(),
            deadline: defaultDueDate(),
            extraTimeHours: 0,
            progress: 0,
            serviceInformation: "",
          });
          setExtraTimeUntil(undefined);
          setTaskKind(null);
          setTaskFeatures([]);
          setSelectedAssigneeIds([]);
          // Re-apply the user's default portfolio so next creation is pre-selected
          const defaultId = branchOptionsRes?.data?.defaultBranchId;
          if (defaultId) setSelectedBranchId(defaultId);
          if (onSuccess) return onSuccess();
          return router.push(ROUTES.tasks);
        }
        toast.error(result?.errors?.message || "Failed to created Task");
      });
    } else if (formType === "edit") {
      startTransition(async () => {
        const result = await editTask({
          taskId,
          startDate: data.startDate,
          deadline: data.deadline,
          extraTimeMinutes: Math.round(Number(data.extraTimeHours ?? 0) * 60),
          status: data.status,
          assgineeId: selectedAssigneeIds[0] || data.assigneeId,
          assigneeIds: selectedAssigneeIds,
          description: data.description,
          department: data.department,
          priority: data.priority,
          supervisor: data.supervisor,
          progress: data.progress,
          serviceInformation: data.serviceInformation,
          features: taskFeatures,
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
            ? "min-h-0 flex-1 gap-5 overflow-y-auto px-6 pt-5 pb-6"
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

        {taskFeatures.length > 0 && (
          <div className="w-full rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="size-4 text-indigo-600" />
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                  Service Deliverables & Features
                </p>
              </div>
              <span className="text-xs font-semibold text-indigo-700">
                {taskFeatures.filter((f) => f.done).length} / {taskFeatures.length} Done ({taskFeatures.length ? Math.round((taskFeatures.filter((f) => f.done).length / taskFeatures.length) * 100) : 0}%)
              </span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {taskFeatures.map((feat, idx) => (
                <label
                  key={feat.id || idx}
                  className={cn(
                    "flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-all",
                    feat.done
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900 font-medium"
                      : "bg-white border-zinc-200 text-zinc-700 hover:border-indigo-300",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={Boolean(feat.done)}
                      onChange={(e) => toggleFeatureDone(idx, e.target.checked)}
                      className="size-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>{feat.name}</span>
                  </div>
                  {feat.done && (
                    <span className="text-[10px] font-bold text-emerald-700 uppercase bg-emerald-100 px-2 py-0.5 rounded-full">
                      Done ✓
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}

        {isCreate && taskKind && (
          <TextInput
            labelId="taskName"
            labelText="Task Name"
            placeholder={taskKind === "client" ? "Enter task name for this client work" : "Enter task name"}
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
            {/* Multi-Assignee Selection */}
            <div className="w-full space-y-2 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-[#651210]" />
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                    Assigned Staff
                  </label>
                </div>
                <span className="text-xs font-semibold text-[#651210] bg-red-50 border border-red-100 px-2.5 py-0.5 rounded-full">
                  {selectedAssigneeIds.length} Selected
                </span>
              </div>

              {/* Selected Assignees Chips */}
              <div className="flex flex-wrap gap-1.5 min-h-[36px] items-center p-1.5 rounded-lg border border-zinc-200 bg-white shadow-inner">
                {selectedAssigneeIds.length === 0 ? (
                  <span className="text-xs text-zinc-400 italic px-1">No staff selected yet</span>
                ) : (
                  selectedAssigneeIds.map((id) => {
                    const staffMember = assignees.find((a) => String(a.id) === String(id));
                    const name = staffMember?.name || id;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#651210] text-white text-xs font-medium shadow-sm transition-all"
                      >
                        <UserCheck className="size-3 text-red-200" />
                        {name}
                        {(isCreate || formType === "edit") && (
                          <button
                            type="button"
                            onClick={() => toggleAssignee(id)}
                            className="hover:text-red-300 font-bold ml-1 text-xs"
                            title="Remove staff member"
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </span>
                    );
                  })
                )}
              </div>

              {/* Staff List Multi-Select */}
              {(isCreate || formType === "edit") && assignees.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <p className="text-[11px] font-semibold text-zinc-500">
                    Click to add/remove staff members:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {assignees.map((staff) => {
                      const isSelected = selectedAssigneeIds.includes(String(staff.id));
                      return (
                        <button
                          key={staff.id}
                          type="button"
                          disabled={transiton}
                          onClick={() => toggleAssignee(String(staff.id))}
                          className={cn(
                            "flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-left transition-all border",
                            isSelected
                              ? "bg-amber-50 border-amber-300 text-amber-900 font-semibold shadow-xs"
                              : "bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100",
                          )}
                        >
                          <span className="truncate">{staff.name}</span>
                          {isSelected ? (
                            <span className="text-amber-700 font-bold text-xs shrink-0 ml-1">✓</span>
                          ) : (
                            <Plus className="size-3.5 text-zinc-400 shrink-0 ml-1" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

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
                isCreate && taskKind === "general" ? "min-h-[140px]" : "h-fit"
              }
              compact={isModal}
            />

            {/* Start Date & Due Date (Garab yaalo / Side-by-Side - Below Description) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-1">
              <DatePicker
                labelText="Start Date (optional)"
                disbaled={transiton || session.data?.user.role === "user"}
                date={startDateValue ?? new Date()}
                showTimePicker
                compact={isModal}
                setDate={(date) => {
                  setValue("startDate", date, { shouldValidate: true });
                }}
                errorMessage={fieldMessage("startDate")}
                invalid={fieldInvalid("startDate")}
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
            </div>

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

            {!isCreate && (
              <>
                <DatePicker
                  labelText="Extra Time Until (optional)"
                  disbaled={transiton || formType === "own:edit" || session.data?.user.role === "user"}
                  date={extraTimeUntil ?? deadlineValue}
                  showTimePicker
                  compact={isModal}
                  setDate={(date) => {
                    const dueDate = getValues("deadline") ?? defaultDueDate();
                    if (!getValues("deadline")) setValue("deadline", dueDate, { shouldValidate: true });

                    // Enforce: extra time must be after the original due date
                    const effectiveDate = date.getTime() < dueDate.getTime() ? dueDate : date;
                    const minutes = Math.max(0, Math.round((effectiveDate.getTime() - dueDate.getTime()) / 60_000));

                    setExtraTimeUntil(effectiveDate);
                    setValue("extraTimeHours", minutes / 60, { shouldValidate: true });

                    // Auto-set status from overdue → pending when extra time is granted
                    if (minutes > 0 && watchedStatus === TaskStatus.overdue) {
                      setValue("status", TaskStatus.pending, { shouldValidate: true });
                    }
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
              </>
            )}

            {!isCreate && (
              <>
                {/* Show overdue banner only when task is overdue AND no extra time has been entered in the form yet */}
                {resolveTaskDisplayStatus(currentTask) === "overdue" && !(Number(extraTimeHoursValue) > 0) ? (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
                    <Lock className="size-4 shrink-0 text-red-600" />
                    <span>Task is overdue and expired. Progress updates are locked until extra time is added.</span>
                  </div>
                ) : Number(extraTimeHoursValue) > 0 ? (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                    <Clock className="size-4 shrink-0 text-emerald-600" />
                    <span>Extra time added! New deadline: {extraTimeUntil ? extraTimeUntil.toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A"}</span>
                  </div>
                ) : null}

                {Number(currentTask?.transferredFromProgress) > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs font-semibold text-indigo-900">
                    <ArrowRightLeft className="size-4 shrink-0 text-indigo-600" />
                    <span>Task was transferred! Work completed before transfer: {currentTask?.transferredFromProgress}%. Minimal progress rate: {currentTask?.transferredFromProgress}%.</span>
                  </div>
                )}

                <TextInput
                  labelId="progress"
                  labelText={`Completion Percentage (%) ${Number(currentTask?.transferredFromProgress) > 0 ? `(Min: ${currentTask?.transferredFromProgress}%)` : ""}`}
                  placeholder={`Enter percentage (${Number(currentTask?.transferredFromProgress) || 0}-100)`}
                  type="number"
                  defaultValue={String(getValues("progress"))}
                  otherProps={{
                    ...register("progress", {
                      valueAsNumber: true,
                      onChange: (e) => {
                        const val = Number(e.target.value);
                        const minVal = Number(currentTask?.transferredFromProgress) || 0;
                        const isAdmin = session.data?.user?.role === "admin" || session.data?.user?.role === "superadmin";
                        if (!isAdmin && val < minVal) {
                          setValue("progress", minVal, { shouldValidate: true });
                        }
                      },
                    }),
                  }}
                  disbaled={!isAssignee || (resolveTaskDisplayStatus(currentTask) === "overdue" && !(Number(extraTimeHoursValue) > 0)) || transiton}
                  errorMessage={fieldMessage("progress")}
                  invalid={fieldInvalid("progress")}
                  compact={isModal}
                />
              </>
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
