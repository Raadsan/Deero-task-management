import { prisma } from "../../../lib/prisma.js";
import { sendTaskAssignmentEmail } from "../../../lib/email.js";
import { generateCustomId } from "../../../lib/id-generator.js";
import {
  clientBranchWhere,
  denyIfOutOfScope,
  getScope,
  mergeWhere,
  taskBranchWhere,
} from "../../../lib/portfolio-scope.js";
import {
  normalizeTaskWriteStatus,
} from "../../../lib/task-status.js";
import {
  buildManagementTaskWhere,
  enrichManagementTask,
  filterTasksByManagementStatus,
  managementDisplayStatus,
  managementTaskInclude,
  taskMatchesManagementSearch,
} from "../../../lib/task-management-filters.js";
import { evaluateTaskLifecycle, initialPersistedStatusForCreate } from "../../../lib/task-lifecycle.js";
import { assertTransferPreservesTaskState, canTransferTask, mergeAssignedByOnCreate } from "../../../lib/task-transfer.js";
import { fridayScheduleErrorForReschedule } from "../../../lib/company-working-days.js";
import {
  appendReviewSubmission,
  assertEmployeeMaySetStatus,
  assertEmployeeMayUpdateProgress,
  canReviewTask,
  recordStatusTransition,
  settleReviewSubmission,
} from "../../../lib/task-status-workflow.js";
import {
  appendProgressHistory,
  applyScheduledFeatures,
  evaluateScheduledTask,
  isScheduleManager,
  lockHoldFields,
  mergeScheduleChange,
  objectFeatures,
  pastScheduleError,
  putTaskOnHold,
  resumeTaskHold,
  scheduleChanged,
} from "../../../lib/scheduled-task-window.js";

export const getAllTasks = async (req, res) => {
  try {
    const { requestTaskStatusMaintenance } = await import("../../../lib/task-status-maintenance.js");
    requestTaskStatusMaintenance(prisma);
    const scope = getScope(req);
    const managementMode = String(req.query.management) === "1";
    const hasManagementFilters = managementMode || [
      "status",
      "taskType",
      "task_type",
      "clientId",
      "client_id",
      "projectId",
      "project_id",
      "serviceId",
      "service_id",
      "employeeId",
      "employee_id",
      "assgineeId",
      "scheduledFrom",
      "scheduled_from",
      "dateFrom",
      "scheduledTo",
      "scheduled_to",
      "dateTo",
      "search",
    ].some((key) => req.query[key] != null && String(req.query[key]).trim() !== "" && String(req.query[key]) !== "all");

    const where = hasManagementFilters
      ? buildManagementTaskWhere(scope, req.query)
      : mergeWhere({ isPersonal: false }, taskBranchWhere(scope));

  const include = hasManagementFilters ? managementTaskInclude : {
      user: { select: { id: true, name: true, portfolioId: true, image: true, jobTitle: true } },
      project: {
        select: {
          id: true,
          name: true,
          clientId: true,
          client: { select: { id: true, institution: true } },
        },
      },
      clientTask: {
        include: {
          Client: {
            select: {
              id: true,
              institution: true,
              clientSubService: {
                select: { subService: { select: { id: true, name: true } } },
              },
            },
          },
        },
      },
      transferHistory: {
        include: {
          fromAssignee: { select: { id: true, name: true, portfolioId: true } },
          toAssignee: { select: { id: true, name: true, portfolioId: true } },
          transferredBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    };

    let tasks = await prisma.task.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
    });

    const statusFilter = String(req.query.status || "all").toLowerCase();
    const search = req.query.search;
    const now = new Date();
    if (hasManagementFilters) {
      if (search) {
        tasks = tasks.filter((task) => taskMatchesManagementSearch(task, search));
      }
      tasks = filterTasksByManagementStatus(tasks, statusFilter, now);
    }

    const enriched = tasks.map((task) => enrichManagementTask(task, tasks));

    res.json({ success: true, data: enriched, meta: hasManagementFilters ? { filtered: true, count: enriched.length } : undefined });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getMyTasks = async (req, res) => {
  try {
    const { requestTaskStatusMaintenance } = await import("../../../lib/task-status-maintenance.js");
    requestTaskStatusMaintenance(prisma);
    const scope = getScope(req);
    // Fallback: if scope.user is null (transient error), use raw session user
    const userId = scope.user?.id ?? req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const taskScope = String(req.query.scope ?? "personal").toLowerCase();
    const now = new Date();
    const where = {
      assgineeId: userId,
    };

    if (taskScope === "personal") {
      where.isPersonal = true;
    } else if (taskScope === "company") {
      where.isPersonal = false;
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, portfolioId: true, image: true, jobTitle: true } },
        clientTask: {
          include: {
            Client: { select: { id: true, institution: true } },
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            clientId: true,
            client: { select: { id: true, institution: true } },
          },
        },
        transferHistory: {
          include: {
            fromAssignee: { select: { id: true, name: true, portfolioId: true } },
            toAssignee: { select: { id: true, name: true, portfolioId: true } },
            transferredBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

async function findAccessibleTask(scope, taskId, include = { user: true }) {
  const userId = scope.user?.id;

  if (userId) {
    const ownTask = await prisma.task.findFirst({
      where: { id: taskId, assgineeId: userId },
      include: {
        ...include,
        transferHistory: {
          include: {
            fromAssignee: { select: { id: true, name: true, portfolioId: true } },
            toAssignee: { select: { id: true, name: true, portfolioId: true } },
            transferredBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (ownTask) return ownTask;
  }

  return prisma.task.findFirst({
    where: mergeWhere({ id: taskId }, taskBranchWhere(scope)),
    include: {
      ...include,
      transferHistory: {
        include: {
          fromAssignee: { select: { id: true, name: true, portfolioId: true } },
          toAssignee: { select: { id: true, name: true, portfolioId: true } },
          transferredBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

const RESERVED_TASK_IDS = new Set(["mine", "assigned", "graph", "metrics", "report"]);

export const getTaskById = async (req, res) => {
  const { id } = req.params;

  if (id === "mine" || id === "assigned") {
    return getMyTasks(req, res);
  }
  if (RESERVED_TASK_IDS.has(id)) {
    return res.status(404).json({ success: false, message: "Task not found" });
  }

  try {
    const scope = getScope(req);
    const task = await findAccessibleTask(scope, id, {
      user: true,
      clientTask: { include: { Client: true } },
    });

    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    // Find siblings (tasks created at the same time with same details)
    let siblings = [];
    if (task.createdAt) {
      const fiveMinutesAgo = new Date(task.createdAt.getTime() - 5 * 60 * 1000);
      const fiveMinutesLater = new Date(task.createdAt.getTime() + 5 * 60 * 1000);
      siblings = await prisma.task.findMany({
        where: {
          description: task.description,
          serviceInformation: task.serviceInformation,
          createdAt: {
            gte: fiveMinutesAgo,
            lte: fiveMinutesLater,
          },
        },
        select: {
          id: true,
          assgineeId: true,
          user: { select: { id: true, name: true } },
        },
      });
    }

    res.json({ success: true, data: { ...task, siblings } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createTask = async (req, res) => {
  const data = req.body;
  try {
    const scope = getScope(req);
    
    // Normalize target assignee IDs into an array
    let targetAssigneeIds = [];
    if (Array.isArray(data.assigneeIds) && data.assigneeIds.length > 0) {
      targetAssigneeIds = data.assigneeIds.filter(Boolean);
    } else if (Array.isArray(data.assgineeId) && data.assgineeId.length > 0) {
      targetAssigneeIds = data.assgineeId.filter(Boolean);
    } else if (data.assgineeId) {
      targetAssigneeIds = [data.assgineeId];
    } else if (data.assigneeId) {
      targetAssigneeIds = [data.assigneeId];
    }

    if (!targetAssigneeIds.length) {
      return res.status(400).json({ success: false, error: "Assignee not found" });
    }

    if (data.clientId) {
      const scopedClient = await prisma.client.findFirst({
        where: mergeWhere({ id: data.clientId }, clientBranchWhere(scope)),
        select: { id: true },
      });
      if (!scopedClient) {
        return res.status(403).json({
          success: false,
          error: "Client is outside your portfolio scope",
        });
      }
    }

    const createdTasks = [];

    for (let i = 0; i < targetAssigneeIds.length; i++) {
      const targetAssigneeId = targetAssigneeIds[i];
      const assignee = await prisma.staff.findUnique({
        where: { id: targetAssigneeId },
        select: { id: true, portfolioId: true },
      });
      if (!assignee) continue;
      if (denyIfOutOfScope(res, scope, assignee.portfolioId)) continue;

      let taskId = (i === 0 && data.id) ? data.id : await generateCustomId({ entityTybe: "tasks" });

      const normalized = normalizeTaskWriteStatus({
        status: data.status,
        progress: data.progress,
        deadline: data.deadline,
        startDate: data.startDate,
        extraTimeMinutes: data.extraTimeMinutes,
        currentStatus: "pending",
        currentProgress: data.progress ?? 0,
        isCreate: true,
        isManager: isScheduleManager(scope.user?.role ?? req.session?.user?.role),
      });
      if (normalized.error) {
        return res.status(400).json({ success: false, error: normalized.error });
      }

      const initialStatus = initialPersistedStatusForCreate(
        {
          progress: normalized.progress,
          deadline: data.deadline ? new Date(data.deadline) : null,
          startDate: data.startDate ? new Date(data.startDate) : null,
          extraTimeMinutes: Math.max(0, Number(data.extraTimeMinutes) || 0),
          features: Array.isArray(data.features) ? data.features : data.features,
        },
        new Date(),
      );

      const taskData = {
        id: taskId,
        description: data.description,
        status: initialStatus,
        priority: data.priority?.toLowerCase(),
        department: data.department || "General",
        deadline: data.deadline ? new Date(data.deadline) : null,
        extraTimeMinutes: Math.max(0, Number(data.extraTimeMinutes) || 0),
        completedAt: normalized.status === "completed" ? (data.completedAt ? new Date(data.completedAt) : new Date()) : null,
        progressUpdatedAt: normalized.progress > 0 ? new Date() : null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        assgineeId: targetAssigneeId,
        supervisor: data.supervisor || "",
        progress: normalized.progress,
        serviceInformation: data.serviceInformation || "",
        isPersonal: Boolean(data.isPersonal),
        features: Array.isArray(data.features)
          ? data.features
          : mergeAssignedByOnCreate(data.features, scope.user?.id ?? req.session?.user?.id),
      };

      if (!data.clientId) {
        const result = await prisma.task.create({ data: taskData });
        createdTasks.push(result);
        if (!data.isPersonal) {
          void notifyTaskAssignee(result, req.user?.name || req.session?.user?.name || "Management").catch((err) => {
            console.error("Failed to create assignee notification:", err);
          });
        }
      } else {
        const result = await prisma.$transaction(
          async (tx) => {
            const task = await tx.task.create({ data: taskData });
            await tx.clientTask.create({
              data: {
                clientId: data.clientId,
                taskId: task.id,
              },
            });
            return task;
          },
          { maxWait: 10000, timeout: 20000 },
        );
        createdTasks.push(result);
        void notifyTaskAssignee(result, req.user?.name || req.session?.user?.name || "Management").catch((err) => {
          console.error("Failed to create assignee notification:", err);
        });
      }
    }

    if (!createdTasks.length) {
      return res.status(400).json({ success: false, error: "Failed to create task for any assignee" });
    }

    res.status(201).json({ success: true, data: createdTasks[0], createdTasks });
  } catch (error) {
    console.error("Create Task Error:", error);
    const message = error.message || "Internal Server Error";
    const statusCode = message.includes("completed") ? 400 : 500;
    res.status(statusCode).json({ success: false, error: message });
  }
};

async function notifyTaskAssignee(result, creatorName) {
  const taskWithUser = await prisma.task.findUnique({
    where: { id: result.id },
    include: { user: true },
  });

  const notifId = Math.random().toString(36).substring(2, 15);
  await prisma.$executeRawUnsafe(
    `INSERT INTO notifications (id, taskId, taskName, assigneeName, deadline, type, userId, isSeen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    notifId,
    result.id,
    `${result.description.substring(0, 50)}...`,
    taskWithUser?.user?.name || "User",
    result.deadline,
    "new-assignment",
    result.assgineeId,
    0,
  );

  // Send assignment email notification to user's email
  if (taskWithUser?.user?.email) {
    void sendTaskAssignmentEmail({
      toEmail: taskWithUser.user.email,
      assigneeName: taskWithUser.user.name,
      taskTitle: result.serviceInformation || result.description.substring(0, 60),
      taskDescription: result.description,
      deadline: result.deadline,
      creatorName,
    }).catch((err) => {
      console.error("Failed to send task assignment email:", err);
    });
  }
}

export const updateTask = async (req, res) => {
  const { id } = req.params;
  const { description, status, priority, department, deadline, extraTimeMinutes, startDate, completedAt, assgineeId, assigneeIds, supervisor, progress, serviceInformation, features, notes } = req.body;
  try {
    const scope = getScope(req);
    const originalTask = await findAccessibleTask(scope, id, { user: true });

    if (!originalTask) {
      return res.status(404).json({ success: false, error: "Task not found" });
    }

    const noteText = typeof notes === "string" ? notes.trim() : "";
    if (noteText.length > 2000) {
      return res.status(400).json({ success: false, error: "Note must be 2000 characters or fewer" });
    }
    const actorRole = scope.user?.role ?? req.session?.user?.role ?? "";
    const normalizedRole = String(actorRole).toLowerCase().replace(/[_-]+/g, " ").trim();
    const canWriteNote = originalTask.assgineeId === scope.user?.id || normalizedRole === "admin" || normalizedRole === "superadmin" || normalizedRole.includes("manager");
    if (noteText && !canWriteNote) {
      return res.status(403).json({ success: false, error: "You do not have permission to add notes to this task" });
    }
    const manager = isScheduleManager(actorRole);
    if (!manager && status !== undefined) {
      const statusError = assertEmployeeMaySetStatus(status, false);
      if (statusError) {
        return res.status(403).json({ success: false, error: statusError });
      }
    }
    const originalFeatures = objectFeatures(originalTask.features);
    const incomingFeatures = objectFeatures(features);
    const scheduleIsChanging = Boolean(incomingFeatures && originalFeatures && scheduleChanged(originalFeatures, incomingFeatures));
    if (scheduleIsChanging && !manager) {
      return res.status(403).json({ success: false, error: "Only a manager can reschedule this task" });
    }
    if (scheduleIsChanging && originalFeatures?.holdActive) {
      return res.status(400).json({ success: false, error: "Resume the task before changing its schedule" });
    }

    let workingFeatures = originalFeatures ? { ...originalFeatures } : null;
    if (scheduleIsChanging && incomingFeatures) {
      workingFeatures = lockHoldFields(
        originalFeatures,
        mergeScheduleChange(originalFeatures, incomingFeatures, originalTask.status),
      );
      const friday = fridayScheduleErrorForReschedule(originalFeatures, workingFeatures);
      if (friday) return res.status(400).json({ success: false, error: friday });
      const past = pastScheduleError(workingFeatures);
      if (past) return res.status(400).json({ success: false, error: past });
    }
    const workingTask = workingFeatures ? { ...originalTask, features: workingFeatures } : originalTask;
    const scheduleGate = evaluateScheduledTask(workingTask, new Date());
    const progressProvided = progress !== undefined && progress !== null && progress !== "";
    const nextProgressNumber = progressProvided ? Number(progress) : Number(originalTask.progress ?? 0);
    const progressChanged = progressProvided && nextProgressNumber !== Number(originalTask.progress ?? 0);
    if (progressChanged && !manager) {
      const progressError = assertEmployeeMayUpdateProgress(originalTask, scope.user, { isManager: false });
      if (progressError) {
        return res.status(403).json({ success: false, error: progressError });
      }
    }
    if (scheduleGate.scheduled && !scheduleGate.canUpdateProgress && (progressChanged || noteText)) {
      return res.status(403).json({ success: false, error: scheduleGate.reason });
    }
    if (scheduleGate.scheduled && progressChanged) {
      workingFeatures = appendProgressHistory(workingFeatures || {}, {
        at: new Date().toISOString(),
        employeeId: scope.user?.id ?? "",
        employeeName: scope.user?.name ?? req.session?.user?.name ?? "User",
        previous: Number(originalTask.progress ?? 0),
        next: nextProgressNumber,
      });
    }
    const scheduledEvaluation = scheduleGate.scheduled
      ? evaluateScheduledTask({ ...workingTask, features: workingFeatures, progress: nextProgressNumber }, new Date())
      : scheduleGate;
    if (scheduleGate.scheduled) {
      workingFeatures = applyScheduledFeatures(workingFeatures || {}, scheduledEvaluation, new Date());
    }

    const progressNote = noteText ? {
      id: "note-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
      text: noteText,
      progress: scheduleGate.scheduled ? nextProgressNumber : Number(progress ?? originalTask.progress ?? 0),
      authorId: scope.user?.id ?? "",
      authorName: scope.user?.name ?? req.session?.user?.name ?? "User",
      authorRole: scope.user?.role ?? req.session?.user?.role ?? "user",
      createdAt: new Date().toISOString(),
    } : null;

    let calculatedProgress = progress;
    let calculatedStatus = status;

    if (Array.isArray(features) && features.length > 0) {
      const doneCount = features.filter((f) => Boolean(f.done || f.completed)).length;
      calculatedProgress = Math.round((doneCount / features.length) * 100);
      if (calculatedProgress === 100 && manager) {
        calculatedStatus = "completed";
      } else if (calculatedProgress > 0) {
        calculatedStatus = "in_progress";
      }
    }

    const normalized = normalizeTaskWriteStatus({
      status: calculatedStatus ?? status,
      progress: calculatedProgress ?? progress,
      deadline: deadline !== undefined ? deadline : originalTask.deadline,
      startDate: startDate !== undefined ? startDate : originalTask.startDate,
      extraTimeMinutes: extraTimeMinutes !== undefined
        ? extraTimeMinutes
        : originalTask.extraTimeMinutes,
      currentStatus: originalTask.status,
      currentProgress: originalTask.progress,
      isManager: manager,
    });

    if (normalized.error && !scheduledEvaluation.scheduled) {
      return res.status(400).json({ success: false, error: normalized.error });
    }

    const writeStatus = scheduledEvaluation.status === "on_hold"
      ? "on_hold"
      : scheduledEvaluation.status === "pending_review"
        ? "pending_review"
        : scheduledEvaluation.scheduled && scheduledEvaluation.status
          ? scheduledEvaluation.status
          : normalized.status;
    const writeProgress = scheduledEvaluation.scheduled
      ? Math.min(100, Math.max(0, nextProgressNumber))
      : normalized.progress;

    if (writeStatus === "completed" && !manager) {
      return res.status(403).json({ success: false, error: "Only a manager can approve and complete a task." });
    }

    // Find siblings (tasks created at the same time with same details)
    let siblings = [];
    if (originalTask.createdAt) {
      const fiveMinutesAgo = new Date(originalTask.createdAt.getTime() - 5 * 60 * 1000);
      const fiveMinutesLater = new Date(originalTask.createdAt.getTime() + 5 * 60 * 1000);
      siblings = await prisma.task.findMany({
        where: {
          description: originalTask.description,
          serviceInformation: originalTask.serviceInformation,
          createdAt: {
            gte: fiveMinutesAgo,
            lte: fiveMinutesLater,
          },
        },
      });
    }

    if (!siblings.length || scheduledEvaluation.scheduled) {
      siblings = [originalTask];
    }

    const requestedAssigneeIds = Array.isArray(assigneeIds) && assigneeIds.length > 0
      ? assigneeIds
      : assgineeId ? [assgineeId] : [originalTask.assgineeId];

    const targetAssigneeIds = Array.from(new Set(requestedAssigneeIds.map(String)));

    // Delete tasks for assignees that were deselected
    const tasksToDelete = siblings.filter(s => !targetAssigneeIds.includes(s.assgineeId));
    for (const t of tasksToDelete) {
      await prisma.task.delete({ where: { id: t.id } });
    }

    const existingAssigneeIds = siblings.filter(s => targetAssigneeIds.includes(s.assgineeId)).map(s => s.assgineeId);
    const newAssigneesToAdd = targetAssigneeIds.filter(id => !existingAssigneeIds.includes(id));

    // Get client task details if associated
    const clientTask = await prisma.clientTask.findFirst({
      where: { taskId: id },
    });

    // Create tasks for newly added assignees
    for (const newAssigneeId of newAssigneesToAdd) {
      const newTaskId = await generateCustomId({ entityTybe: "tasks" });
      const taskData = {
        id: newTaskId,
        description: description ?? originalTask.description,
        status: writeStatus,
        priority: (priority ?? originalTask.priority)?.toLowerCase(),
        department: department ?? originalTask.department ?? "General",
        deadline: deadline !== undefined ? (deadline ? new Date(deadline) : null) : originalTask.deadline,
        extraTimeMinutes: extraTimeMinutes !== undefined ? Math.max(0, Number(extraTimeMinutes) || 0) : originalTask.extraTimeMinutes,
        completedAt: writeStatus === "completed" ? (completedAt ? new Date(completedAt) : new Date()) : null,
        progressUpdatedAt: writeProgress > 0 ? new Date() : null,
        startDate: scheduledEvaluation.scheduled && scheduledEvaluation.startAt
          ? scheduledEvaluation.startAt
          : startDate !== undefined ? (startDate ? new Date(startDate) : null) : originalTask.startDate,
        assgineeId: newAssigneeId,
        supervisor: supervisor ?? originalTask.supervisor ?? "",
        progress: writeProgress,
        serviceInformation: serviceInformation ?? originalTask.serviceInformation ?? "",
        isPersonal: originalTask.isPersonal,
        features: features ?? originalTask.features,
      };

      if (!clientTask?.clientId) {
        const result = await prisma.task.create({ data: taskData });
        void notifyTaskAssignee(result, req.user?.name || req.session?.user?.name || "Management").catch(console.error);
      } else {
        const result = await prisma.$transaction(async (tx) => {
          const task = await tx.task.create({ data: taskData });
          await tx.clientTask.create({
            data: {
              clientId: clientTask.clientId,
              taskId: newTaskId,
            },
          });
          return task;
        });
        void notifyTaskAssignee(result, req.user?.name || req.session?.user?.name || "Management").catch(console.error);
      }
    }

    // Update remaining sibling tasks
    const tasksToUpdate = siblings.filter(s => targetAssigneeIds.includes(s.assgineeId));
    let mainUpdatedTask = null;

    for (const t of tasksToUpdate) {
      const shouldCaptureOriginalDeadline =
        extraTimeMinutes !== undefined &&
        Math.max(0, Number(extraTimeMinutes) || 0) > 0 &&
        !t.originalDeadline;

      const updated = await prisma.task.update({
        where: { id: t.id },
        data: {
          ...(description !== undefined ? { description } : {}),
          status: writeStatus,
          ...(priority !== undefined ? { priority: priority?.toLowerCase() } : {}),
          ...(department !== undefined ? { department } : {}),
          ...(deadline !== undefined
            ? { deadline: deadline ? new Date(deadline) : null }
            : {}),
          ...(extraTimeMinutes !== undefined
            ? { extraTimeMinutes: Math.max(0, Number(extraTimeMinutes) || 0) }
            : {}),
          ...(shouldCaptureOriginalDeadline
            ? { originalDeadline: t.deadline }
            : {}),
          ...(scheduledEvaluation.scheduled && scheduledEvaluation.startAt
            ? { startDate: scheduledEvaluation.startAt }
            : startDate !== undefined
              ? { startDate: startDate ? new Date(startDate) : null }
              : {}),
          ...(supervisor !== undefined ? { supervisor } : {}),
          progress: writeProgress,
          ...(t.progress !== writeProgress ? { progressUpdatedAt: new Date() } : {}),
          ...(writeStatus === "completed"
            ? { completedAt: completedAt ? new Date(completedAt) : (t.completedAt || new Date()) }
            : { completedAt: null }),
          ...(serviceInformation !== undefined ? { serviceInformation } : {}),
          ...(scheduledEvaluation.scheduled
            ? { features: lockHoldFields(originalFeatures, workingFeatures) }
            : features !== undefined && !Array.isArray(features)
              ? { features: lockHoldFields(originalFeatures, features) }
              : features !== undefined
                ? { features }
                : {}),
          ...(progressNote && t.id === id ? { progressNotes: [...(Array.isArray(t.progressNotes) ? t.progressNotes : []), progressNote] } : {}),
        },
        include: {
          user: true,
          transferHistory: {
            include: {
              fromAssignee: { select: { id: true, name: true, portfolioId: true } },
              toAssignee: { select: { id: true, name: true, portfolioId: true } },
              transferredBy: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (t.id === id) {
        mainUpdatedTask = updated;
      }

      if (progressNote && t.id === id) {
        try {
          const noteNotifId = Math.random().toString(36).substring(2, 15);
          const targetUserId = progressNote.authorId === updated.assgineeId
            ? (updated.supervisor || null)
            : updated.assgineeId;

          await prisma.$executeRawUnsafe(
            `INSERT INTO notifications (id, taskId, taskName, assigneeName, deadline, type, userId, isSeen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            noteNotifId,
            updated.id,
            `Note on ${updated.serviceInformation || updated.description || "Task"}: "${progressNote.text.substring(0, 45)}"`,
            progressNote.authorName || "User",
            updated.deadline || new Date(),
            "task-comment",
            targetUserId || updated.assgineeId,
            0,
          );
        } catch (err) {
          console.error("Failed to create note notification:", err);
        }
      }

      if (t.status !== writeStatus) {
        try {
          const notifId = Math.random().toString(36).substring(2, 15);
          await prisma.$executeRawUnsafe(
            `INSERT INTO notifications (id, taskId, taskName, assigneeName, deadline, type, userId, isSeen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            notifId,
            updated.id,
            `${(updated.serviceInformation || updated.description || "Task").substring(0, 50)} (${writeStatus.replace("_", " ")})`,
            updated.user?.name || "User",
            updated.deadline || new Date(),
            writeStatus === "in_progress" ? "status-in_progress" : "status-update",
            updated.assgineeId,
            0,
          );
        } catch (err) {
          console.error("Failed to create status notification:", err);
        }
      }
    }

    if (!mainUpdatedTask && tasksToUpdate.length > 0) {
      mainUpdatedTask = tasksToUpdate[0];
    }

    res.json({ success: true, data: mainUpdatedTask });
  } catch (error) {
    console.error("Update Task Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};



export const deleteTask = async (req, res) => {
  const { id } = req.params;
  try {
    const scope = getScope(req);
    const existing = await findAccessibleTask(scope, id, { user: true });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Task not found" });
    }
    await prisma.task.delete({ where: { id } });
    res.json({ success: true, message: "Task deleted" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getMonthlyGraphData = async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    const scope = getScope(req);
    const fromDate = startDate ? new Date(startDate) : undefined;
    const toDate = endDate ? new Date(endDate) : undefined;
    if (toDate) toDate.setHours(23, 59, 59, 999);

    const where = mergeWhere(
      { isPersonal: false },
      taskBranchWhere(scope),
      fromDate || toDate ? { createdAt: { gte: fromDate, lte: toDate } } : {},
    );

    const tasks = await prisma.task.findMany({
      where,
      select: { createdAt: true, status: true },
    });

    // Group by "Month Year" string
    const monthMap = new Map();
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    tasks.forEach((task) => {
      const d = new Date(task.createdAt);
      const key = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      if (!monthMap.has(key)) {
        monthMap.set(key, { month: key, "Registered Tasks": 0, "Completed Tasks": 0, _ts: d.getTime() });
      }
      const entry = monthMap.get(key);
      entry["Registered Tasks"] += 1;
      if (task.status === "completed") {
        entry["Completed Tasks"] += 1;
      }
    });

    // Sort chronologically
    const data = Array.from(monthMap.values())
      .sort((a, b) => a._ts - b._ts)
      .map(({ _ts, ...rest }) => rest);

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getYearlyGraphData = async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    const scope = getScope(req);
    const fromDate = startDate ? new Date(startDate) : undefined;
    const toDate = endDate ? new Date(endDate) : undefined;
    if (toDate) toDate.setHours(23, 59, 59, 999);

    const where = mergeWhere(
      { isPersonal: false },
      taskBranchWhere(scope),
      fromDate || toDate ? { createdAt: { gte: fromDate, lte: toDate } } : {},
    );

    const tasks = await prisma.task.findMany({
      where,
      select: { createdAt: true, status: true },
    });

    // Group by year
    const yearMap = new Map();

    tasks.forEach((task) => {
      const year = String(new Date(task.createdAt).getFullYear());
      if (!yearMap.has(year)) {
        yearMap.set(year, { year, "Registered Tasks": 0, "Completed Tasks": 0 });
      }
      const entry = yearMap.get(year);
      entry["Registered Tasks"] += 1;
      if (task.status === "completed") {
        entry["Completed Tasks"] += 1;
      }
    });

    const data = Array.from(yearMap.values()).sort((a, b) =>
      Number(a.year) - Number(b.year)
    );

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getDashboardMetrics = async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    const scope = getScope(req);
    const fromDate = startDate ? new Date(startDate) : undefined;
    const toDate = endDate ? new Date(endDate) : undefined;
    if (toDate) toDate.setHours(23, 59, 59, 999);

    const dateWhere =
      fromDate || toDate ? { createdAt: { gte: fromDate, lte: toDate } } : {};
    const taskWhere = mergeWhere({ isPersonal: false }, taskBranchWhere(scope), dateWhere);
    const clientWhere = mergeWhere(clientBranchWhere(scope), dateWhere);

    const [totalTasks, completedTasks, pendingTasks, overdueTasks, totalClients] = await Promise.all([
      prisma.task.count({ where: taskWhere }),
      prisma.task.count({ where: mergeWhere(taskWhere, { status: "completed" }) }),
      prisma.task.count({ where: mergeWhere(taskWhere, { status: "pending" }) }),
      prisma.task.count({ where: mergeWhere(taskWhere, { status: "overdue" }) }),
      prisma.client.count({ where: clientWhere }),
    ]);

    res.json({
      success: true,
      data: [
        { title: "Total Tasks", totalTasks },
        { title: "Completed Tasks", totalTasks: completedTasks },
        { title: "In Process Tasks", totallPending: pendingTasks },
        { title: "Overdue Tasks", totalTasks: overdueTasks },
        { title: "Total Clients", totalEarning: totalClients },
      ],
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getTasksReport = async (req, res) => {
  const { userIdForTaskReport, startDate, endDate } = req.query;
  try {
    const { requestTaskStatusMaintenance } = await import("../../../lib/task-status-maintenance.js");
    requestTaskStatusMaintenance(prisma);
    const scope = getScope(req);
    const from = startDate ? new Date(startDate) : undefined;
    const to = endDate ? new Date(endDate) : undefined;
    const useManagementWhere = [
      "status",
      "taskType",
      "clientId",
      "projectId",
      "serviceId",
      "employeeId",
      "scheduledFrom",
      "scheduledTo",
      "search",
    ].some((key) => req.query[key] && String(req.query[key]) !== "all");

    let where = useManagementWhere
      ? buildManagementTaskWhere(scope, { ...req.query, employeeId: req.query.employeeId || userIdForTaskReport })
      : mergeWhere({ isPersonal: false }, taskBranchWhere(scope), userIdForTaskReport ? { assgineeId: userIdForTaskReport } : {});

    if (from || to) {
      where.createdAt = { ...(where.createdAt || {}), ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
    }

    let tasks = await prisma.task.findMany({
      where,
      include: managementTaskInclude,
      orderBy: { createdAt: "desc" },
    });

    const statusFilter = String(req.query.status || "all").toLowerCase();
    const search = req.query.search;
    const now = new Date();
    if (search) tasks = tasks.filter((task) => taskMatchesManagementSearch(task, search));
    tasks = filterTasksByManagementStatus(tasks, statusFilter, now);

    const employeeId = userIdForTaskReport || req.query.employeeId;
    const user = employeeId ? await prisma.staff.findUnique({ where: { id: String(employeeId) } }) : null;

    const data = {
      meta: {
        userName: user?.name || "All Employees",
        userEmail: user?.email || "",
        period: startDate && endDate ? `From ${startDate} to ${endDate}` : "All Time",
        totalTasks: tasks.length,
        completedTasks: tasks.filter((t) => managementDisplayStatus(t, now) === "completed").length,
        pending: tasks.filter((t) => managementDisplayStatus(t, now) === "pending").length,
        pendingReview: tasks.filter((t) => managementDisplayStatus(t, now) === "pending_review").length,
        overdue: tasks.filter((t) => managementDisplayStatus(t, now) === "overdue").length,
      },
      tasks: tasks.map((t) => ({
        id: t.id,
        description: t.description,
        taskType: t.projectId ? "project" : "standalone",
        project: t.project?.name || "N/A",
        status: managementDisplayStatus(t, now),
        priority: t.priority,
        startDate: t.startDate,
        deadline: t.deadline,
        createdAt: t.createdAt,
        client: t.project?.client?.institution || t.clientTask[0]?.Client?.institution || "N/A",
        progress: t.progress,
      })),
    };

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

function holdActor(scope, req) {
  return {
    userId: scope.user?.id || null,
    userName: scope.user?.name || req.session?.user?.name || "Manager",
  };
}

async function applyHoldChange(scope, taskId, change, actor) {
  const accessible = await findAccessibleTask(scope, taskId, { user: true });
  if (!accessible) return { status: 404, body: { success: false, error: "Task not found" } };
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const task = await tx.task.findFirst({ where: { id: accessible.id } });
      if (!task) {
        const missing = new Error("Task not found");
        missing.statusCode = 404;
        throw missing;
      }
      const outcome = change(task);
      if (!outcome.ok) {
        const rejected = new Error(outcome.error);
        rejected.statusCode = outcome.status || 400;
        throw rejected;
      }
      const now = new Date();
      const evaluation = evaluateScheduledTask({ ...task, features: outcome.features, progress: task.progress }, now);
      const features = applyScheduledFeatures(outcome.features, evaluation, now);
      let status = evaluation.status === "on_hold"
        ? "on_hold"
        : evaluation.status || task.status;
      if (evaluation.status !== "on_hold") {
        const life = evaluateTaskLifecycle({ ...task, features, status: task.status }, now);
        status = life.persistStatus;
      }
      const nextFeatures = recordStatusTransition(features, task, {
        toStatus: status,
        user: { id: actor?.userId, name: actor?.userName },
        reason: evaluation.status === "on_hold" ? "Task placed on hold" : "Task resumed from hold",
      });
      return tx.task.update({
        where: { id: task.id },
        data: {
          features: nextFeatures,
          status,
        },
      });
    });
    return { status: 200, body: { success: true, data: updated } };
  } catch (error) {
    const status = error.statusCode || 500;
    return { status, body: { success: false, error: error.message } };
  }
}

export const holdTask = async (req, res) => {
  const scope = getScope(req);
  if (!isScheduleManager(scope.user?.role)) {
    return res.status(403).json({ success: false, error: "Only a manager can put a task on hold" });
  }
  const actor = holdActor(scope, req);
  const result = await applyHoldChange(scope, req.params.id, (task) => putTaskOnHold(task.features, {
    reason: req.body?.reason,
    userId: actor.userId,
    userName: actor.userName,
    progress: task.progress,
    taskStatus: task.status,
    taskId: task.id,
    now: new Date(),
  }), actor);
  return res.status(result.status).json(result.body);
};

export const resumeTask = async (req, res) => {
  const scope = getScope(req);
  if (!isScheduleManager(scope.user?.role)) {
    return res.status(403).json({ success: false, error: "Only a manager can resume a task" });
  }
  const actor = holdActor(scope, req);
  const result = await applyHoldChange(scope, req.params.id, (task) => resumeTaskHold(task.features, {
    userId: actor.userId,
    userName: actor.userName,
    taskId: task.id,
    now: new Date(),
  }), actor);
  return res.status(result.status).json(result.body);
};

async function notifyReviewer(task, reviewerUserId, type, message) {
  if (!reviewerUserId) return;
  try {
    const notifId = Math.random().toString(36).substring(2, 15);
    await prisma.$executeRawUnsafe(
      `INSERT INTO notifications (id, taskId, taskName, assigneeName, deadline, type, userId, isSeen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      notifId,
      task.id,
      message.substring(0, 120),
      task.user?.name || "User",
      task.deadline || new Date(),
      type,
      reviewerUserId,
      0,
    );
  } catch (error) {
    console.error("Failed to create review notification:", error);
  }
}

export const submitTaskForReview = async (req, res) => {
  const { id } = req.params;
  const scope = getScope(req);
  const userId = scope.user?.id ?? req.session?.user?.id;
  if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });

  try {
    const task = await findAccessibleTask(scope, id, { user: true });
    if (!task) return res.status(404).json({ success: false, error: "Task not found" });
    if (task.assgineeId !== userId) {
      return res.status(403).json({ success: false, error: "Only the assignee can submit this task for review." });
    }
    if (String(task.status).toLowerCase() === "pending_review") {
      return res.status(400).json({ success: false, error: "This task is already pending review." });
    }
  if (String(task.status).toLowerCase() === "completed") {
      return res.status(400).json({ success: false, error: "This task is already completed." });
    }
    const progress = Math.min(100, Math.max(0, Number(req.body?.progress ?? task.progress ?? 0)));
    if (progress < 100) {
      return res.status(400).json({ success: false, error: "Set progress to 100% before submitting for review." });
    }

    const gate = evaluateScheduledTask(task, new Date());
    if (gate.scheduled && !gate.canUpdateProgress && gate.status !== "in_progress" && gate.status !== "overdue") {
      return res.status(403).json({ success: false, error: gate.reason || "Cannot submit this task yet." });
    }

    const submissionId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const submission = {
      id: submissionId,
      progress: 100,
      notes: String(req.body?.notes || "").trim(),
      attachments: Array.isArray(req.body?.attachments) ? req.body.attachments : [],
      employeeId: userId,
      employeeName: scope.user?.name || req.session?.user?.name || "Employee",
      submittedAt: new Date().toISOString(),
      decision: "pending",
    };

    const appended = appendReviewSubmission(task.features, submission);
    if (appended.error) {
      return res.status(400).json({ success: false, error: appended.error });
    }

    const nextFeatures = recordStatusTransition(appended.features, task, {
      toStatus: "pending_review",
      user: { id: userId, name: submission.employeeName },
      reason: submission.notes || "Submitted for review",
      reviewDecision: "submitted",
    });

    const updated = await prisma.task.update({
      where: { id: task.id },
      data: {
        status: "pending_review",
        progress: 100,
        progressUpdatedAt: new Date(),
        features: nextFeatures,
      },
      include: { user: true },
    });

    const supervisorId = String(task.supervisor || "").trim();
    const reviewerId = supervisorId && supervisorId.length > 20 ? supervisorId : null;
    void notifyReviewer(
      updated,
      reviewerId,
      "task-review",
      `Task submitted for review: ${updated.serviceInformation || updated.description}`,
    );

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("submitTaskForReview:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const approveTask = async (req, res) => {
  const { id } = req.params;
  const scope = getScope(req);
  const actor = scope.user ?? req.session?.user;
  if (!actor?.id) return res.status(401).json({ success: false, error: "Unauthorized" });

  try {
    const task = await findAccessibleTask(scope, id, { user: true });
    if (!task) return res.status(404).json({ success: false, error: "Task not found" });
    if (!canReviewTask(actor, task)) {
      return res.status(403).json({ success: false, error: "You are not authorized to approve this task." });
    }
    if (String(task.status).toLowerCase() !== "pending_review") {
      return res.status(400).json({ success: false, error: "Only tasks pending review can be approved." });
    }

    const settled = settleReviewSubmission(task.features, {
      decision: "approved",
      reviewerId: actor.id,
      reviewerName: actor.name || "Reviewer",
      comments: String(req.body?.comments || "").trim(),
    });
    if (settled.error) return res.status(400).json({ success: false, error: settled.error });

    const now = new Date();
    const nextFeatures = recordStatusTransition(settled.features, task, {
      toStatus: "completed",
      user: { id: actor.id, name: actor.name },
      reason: settled.submission?.notes || "Approved",
      reviewDecision: "approved",
    });

    const updated = await prisma.task.update({
      where: { id: task.id },
      data: {
        status: "completed",
        progress: 100,
        completedAt: now,
        features: applyScheduledFeatures(nextFeatures, { scheduled: true, status: "completed", projectStatus: "COMPLETED" }, now),
      },
      include: { user: true },
    });

    void notifyReviewer(
      updated,
      updated.assgineeId,
      "task-approved",
      `Your task was approved: ${updated.serviceInformation || updated.description}`,
    );

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("approveTask:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const rejectTask = async (req, res) => {
  const { id } = req.params;
  const scope = getScope(req);
  const actor = scope.user ?? req.session?.user;
  if (!actor?.id) return res.status(401).json({ success: false, error: "Unauthorized" });

  const comments = String(req.body?.comments || req.body?.reason || "").trim();
  if (!comments) {
    return res.status(400).json({ success: false, error: "Revision comments are required when rejecting a submission." });
  }

  try {
    const task = await findAccessibleTask(scope, id, { user: true });
    if (!task) return res.status(404).json({ success: false, error: "Task not found" });
    if (!canReviewTask(actor, task)) {
      return res.status(403).json({ success: false, error: "You are not authorized to reject this task." });
    }
    if (String(task.status).toLowerCase() !== "pending_review") {
      return res.status(400).json({ success: false, error: "Only tasks pending review can be rejected." });
    }

    const settled = settleReviewSubmission(task.features, {
      decision: "rejected",
      reviewerId: actor.id,
      reviewerName: actor.name || "Reviewer",
      comments,
    });
    if (settled.error) return res.status(400).json({ success: false, error: settled.error });

    const grantMinutes = Math.max(0, Number(req.body?.extraTimeMinutes ?? req.body?.additionalMinutes ?? 0) || 0);
    const nextExtra = Math.max(0, Number(task.extraTimeMinutes || 0)) + grantMinutes;

    const now = new Date();
    let nextFeatures = recordStatusTransition(settled.features, task, {
      toStatus: "in_progress",
      user: { id: actor.id, name: actor.name },
      reason: comments,
      reviewDecision: "rejected",
    });

    if (grantMinutes > 0) {
      const schedule = { ...(objectFeatures(nextFeatures) || {}) };
      const history = Array.isArray(schedule.scheduleAdjustments) ? schedule.scheduleAdjustments : [];
      nextFeatures = {
        ...schedule,
        scheduleAdjustments: [
          ...history,
          {
            type: "extra_time_granted",
            minutes: grantMinutes,
            grantedAt: now.toISOString(),
            grantedById: actor.id,
            grantedByName: actor.name,
            originalDeadline: task.deadline,
            originalExtraMinutes: task.extraTimeMinutes,
          },
        ],
      };
    }

    const life = evaluateTaskLifecycle(
      {
        ...task,
        status: "in_progress",
        progress: task.progress,
        extraTimeMinutes: nextExtra,
        features: nextFeatures,
      },
      now,
    );

    const updated = await prisma.task.update({
      where: { id: task.id },
      data: {
        status: life.persistStatus,
        extraTimeMinutes: nextExtra,
        features: nextFeatures,
      },
      include: { user: true },
    });

    void notifyReviewer(
      updated,
      updated.assgineeId,
      "task-rejected",
      `Your submission needs revisions: ${updated.serviceInformation || updated.description}`,
    );

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("rejectTask:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

async function notifyAssigneeTransfer({ task, userId, title, type }) {
  if (!userId) return;
  try {
    const notifId = Math.random().toString(36).substring(2, 15);
    await prisma.$executeRawUnsafe(
      `INSERT INTO notifications (id, taskId, taskName, assigneeName, deadline, type, userId, isSeen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      notifId,
      task.id,
      title.substring(0, 120),
      task.user?.name || "User",
      task.deadline || new Date(),
      type,
      userId,
      0,
    );
  } catch (error) {
    console.error("Failed to create transfer notification:", error);
  }
}

export const transferTask = async (req, res) => {
  const { id } = req.params;
  const scope = getScope(req);
  const actor = {
    id: scope.user?.id ?? req.session?.user?.id,
    name: scope.user?.name ?? req.session?.user?.name,
    role: scope.user?.role ?? req.session?.user?.role,
  };
  if (!actor.id) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const toAssigneeId = String(req.body?.assigneeId || req.body?.newAssigneeId || "").trim();
  const reason = String(req.body?.reason || "").trim();
  const note = String(req.body?.note || req.body?.notes || "").trim();

  if (!toAssigneeId) {
    return res.status(400).json({ success: false, error: "New employee is required" });
  }
  if (!reason) {
    return res.status(400).json({ success: false, error: "Transfer reason is required" });
  }
  if (reason.length > 500) {
    return res.status(400).json({ success: false, error: "Reason must be 500 characters or fewer" });
  }

  try {
    const task = await prisma.task.findFirst({
      where: mergeWhere({ id }, taskBranchWhere(scope)),
      select: {
        id: true,
        assgineeId: true,
        status: true,
        progress: true,
        deadline: true,
        startDate: true,
        extraTimeMinutes: true,
        originalDeadline: true,
        completedAt: true,
        description: true,
        serviceInformation: true,
        supervisor: true,
        features: true,
        user: { select: { id: true, name: true, email: true } },
        transferHistory: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!task) {
      return res.status(404).json({ success: false, error: "Task not found" });
    }

    if (!canTransferTask(actor, task)) {
      return res.status(403).json({ success: false, error: "You are not authorized to transfer this task" });
    }

    if (String(task.status).toLowerCase() === "completed") {
      return res.status(400).json({ success: false, error: "Completed tasks cannot be reassigned" });
    }

    if (task.assgineeId === toAssigneeId) {
      return res.status(400).json({ success: false, error: "Select a different employee than the current assignee" });
    }

    const newAssignee = await prisma.staff.findUnique({
      where: { id: toAssigneeId },
      select: { id: true, name: true, email: true, banned: true, portfolioId: true },
    });
    if (!newAssignee || newAssignee.banned) {
      return res.status(400).json({ success: false, error: "The selected employee is not available for assignment" });
    }
    if (denyIfOutOfScope(res, scope, newAssignee.portfolioId)) return;

    const fromAssigneeId = task.assgineeId;
    const progressAtTransfer = Number(task.progress ?? 0);
    const snapshot = {
      progress: task.progress,
      status: task.status,
      deadline: task.deadline,
      startDate: task.startDate,
      extraTimeMinutes: task.extraTimeMinutes,
      originalDeadline: task.originalDeadline,
      completedAt: task.completedAt,
    };

    const updated = await prisma.$transaction(async (tx) => {
      await tx.taskTransferHistory.create({
        data: {
          taskId: task.id,
          fromAssigneeId,
          toAssigneeId,
          progressAtTransfer,
          deadlineAtTransfer: task.deadline,
          transferredById: actor.id,
          reason,
          note: note || null,
        },
      });

      const row = await tx.task.update({
        where: { id: task.id },
        data: { assgineeId: toAssigneeId },
        include: {
          user: { select: { id: true, name: true, email: true, portfolioId: true } },
          transferHistory: {
            include: {
              fromAssignee: { select: { id: true, name: true } },
              toAssignee: { select: { id: true, name: true } },
              transferredBy: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      const integrityError = assertTransferPreservesTaskState(snapshot, row);
      if (integrityError) {
        throw new Error(integrityError);
      }
      return row;
    });

    const taskTitle = updated.serviceInformation || updated.description || "Task";
    void notifyAssigneeTransfer({
      task: updated,
      userId: toAssigneeId,
      title: `Task transferred to you: ${taskTitle}`,
      type: "new-assignment",
    });
    void notifyAssigneeTransfer({
      task: { ...updated, user: task.user },
      userId: fromAssigneeId,
      title: `Task transferred away: ${taskTitle}`,
      type: "task-transfer",
    });

    if (newAssignee.email) {
      void sendTaskAssignmentEmail({
        toEmail: newAssignee.email,
        assigneeName: newAssignee.name,
        taskTitle,
        taskDescription: updated.description,
        deadline: updated.deadline,
        creatorName: actor.name || "Management",
      }).catch(console.error);
    }

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("transferTask:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
