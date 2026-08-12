import { prisma } from "../lib/prisma.js";
import { sendTaskAssignmentEmail } from "../lib/email.js";
import { generateCustomId } from "../lib/id-generator.js";
import {
  clientBranchWhere,
  denyIfOutOfScope,
  getScope,
  mergeWhere,
  taskBranchWhere,
} from "../lib/portfolio-scope.js";
import {
  normalizeTaskWriteStatus,
} from "../lib/task-status.js";

export const getAllTasks = async (req, res) => {
  try {
    const scope = getScope(req);
    const tasks = await prisma.task.findMany({
      where: mergeWhere({ isPersonal: false }, taskBranchWhere(scope)),
      include: {
        user: { select: { id: true, name: true, portfolioId: true } },
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
      },
      orderBy: { createdAt: "desc" },
    });

    // Attach siblings to each task for batch-delete awareness
    const enriched = await Promise.all(
      tasks.map(async (task) => {
        if (!task.createdAt) return { ...task, siblings: [] };
        const window = 5 * 60 * 1000;
        const siblings = await prisma.task.findMany({
          where: {
            description: task.description,
            serviceInformation: task.serviceInformation,
            createdAt: {
              gte: new Date(task.createdAt.getTime() - window),
              lte: new Date(task.createdAt.getTime() + window),
            },
          },
          select: {
            id: true,
            assgineeId: true,
            user: { select: { id: true, name: true } },
          },
        });
        return { ...task, siblings };
      })
    );

    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getMyTasks = async (req, res) => {
  try {
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
        user: { select: { id: true, name: true, portfolioId: true } },
        clientTask: {
          include: {
            Client: { select: { id: true, institution: true } },
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
        currentStatus: "pending",
        currentProgress: data.progress ?? 0,
      });
      if (normalized.error) {
        return res.status(400).json({ success: false, error: normalized.error });
      }

      const taskData = {
        id: taskId,
        description: data.description,
        status: normalized.status,
        priority: data.priority?.toLowerCase(),
        department: data.department || "General",
        deadline: data.deadline ? new Date(data.deadline) : null,
        extraTimeMinutes: Math.max(0, Number(data.extraTimeMinutes) || 0),
        completedAt: normalized.status === "completed" ? new Date() : null,
        progressUpdatedAt: normalized.progress > 0 ? new Date() : null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        assgineeId: targetAssigneeId,
        supervisor: data.supervisor || "",
        progress: normalized.progress,
        serviceInformation: data.serviceInformation || "",
        isPersonal: Boolean(data.isPersonal),
        features: Array.isArray(data.features) ? data.features : null,
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
  const { description, status, priority, department, deadline, extraTimeMinutes, startDate, assgineeId, assigneeIds, supervisor, progress, serviceInformation, features } = req.body;
  try {
    const scope = getScope(req);
    const originalTask = await findAccessibleTask(scope, id, { user: true });

    if (!originalTask) {
      return res.status(404).json({ success: false, error: "Task not found" });
    }

    let calculatedProgress = progress;
    let calculatedStatus = status;

    if (Array.isArray(features) && features.length > 0) {
      const doneCount = features.filter((f) => Boolean(f.done || f.completed)).length;
      calculatedProgress = Math.round((doneCount / features.length) * 100);
      if (calculatedProgress === 100) {
        calculatedStatus = "completed";
      } else if (calculatedProgress > 0 && status !== "completed") {
        calculatedStatus = "in_progress";
      }
    }

    const normalized = normalizeTaskWriteStatus({
      status: calculatedStatus ?? status,
      progress: calculatedProgress ?? progress,
      deadline,
      extraTimeMinutes,
      currentStatus: originalTask.status,
      currentProgress: originalTask.progress,
    });

    if (normalized.error) {
      return res.status(400).json({ success: false, error: normalized.error });
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

    const targetAssigneeIds = Array.isArray(assigneeIds) && assigneeIds.length > 0
      ? assigneeIds.filter(Boolean)
      : [assgineeId || originalTask.assgineeId].filter(Boolean);

    if (!targetAssigneeIds.length) {
      return res.status(400).json({ success: false, error: "At least one assignee is required" });
    }

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
        status: normalized.status,
        priority: (priority ?? originalTask.priority)?.toLowerCase(),
        department: department ?? originalTask.department ?? "General",
        deadline: deadline !== undefined ? (deadline ? new Date(deadline) : null) : originalTask.deadline,
        extraTimeMinutes: extraTimeMinutes !== undefined ? Math.max(0, Number(extraTimeMinutes) || 0) : originalTask.extraTimeMinutes,
        completedAt: normalized.status === "completed" ? new Date() : null,
        progressUpdatedAt: normalized.progress > 0 ? new Date() : null,
        startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : originalTask.startDate,
        assgineeId: newAssigneeId,
        supervisor: supervisor ?? originalTask.supervisor ?? "",
        progress: normalized.progress,
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
          status: normalized.status,
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
          ...(startDate !== undefined
            ? { startDate: startDate ? new Date(startDate) : null }
            : {}),
          ...(supervisor !== undefined ? { supervisor } : {}),
          progress: normalized.progress,
          ...(t.progress !== normalized.progress ? { progressUpdatedAt: new Date() } : {}),
          ...(t.status !== "completed" && normalized.status === "completed"
            ? { completedAt: new Date() }
            : t.status === "completed" && normalized.status !== "completed"
              ? { completedAt: null }
              : {}),
          ...(serviceInformation !== undefined ? { serviceInformation } : {}),
          ...(features !== undefined ? { features } : {}),
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

      if (t.status !== normalized.status) {
        try {
          const notifId = Math.random().toString(36).substring(2, 15);
          await prisma.$executeRawUnsafe(
            `INSERT INTO notifications (id, taskId, taskName, assigneeName, deadline, type, userId, isSeen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            notifId,
            updated.id,
            `${(updated.serviceInformation || updated.description || "Task").substring(0, 50)} (${normalized.status.replace("_", " ")})`,
            updated.user?.name || "User",
            updated.deadline || new Date(),
            normalized.status === "in_progress" ? "status-in_progress" : "status-update",
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
    const scope = getScope(req);
    const from = startDate ? new Date(startDate) : undefined;
    const to = endDate ? new Date(endDate) : undefined;
    const where = mergeWhere({ isPersonal: false }, taskBranchWhere(scope), {
      assgineeId: userIdForTaskReport,
    });
    if (from || to) {
      where.createdAt = { gte: from, lte: to };
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        clientTask: { include: { Client: { include: { clientSubService: { include: { subService: true } } } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    const user = await prisma.staff.findUnique({ where: { id: userIdForTaskReport } });

    const data = {
      meta: {
        userName: user?.name || "Unknown User",
        userEmail: user?.email || "",
        period: startDate && endDate ? `From ${startDate} to ${endDate}` : "All Time",
        totalTasks: tasks.length,
        completedTasks: tasks.filter((t) => t.status === "completed").length,
        pending: tasks.filter((t) => t.status === "pending").length,
        overdue: tasks.filter((t) => t.status === "overdue").length,
      },
      tasks: tasks.map(t => ({
        id: t.id,
        description: t.description,
        status: t.status,
        priority: t.priority,
        deadline: t.deadline,
        createdAt: t.createdAt,
        client: t.clientTask[0]?.Client?.institution || "N/A",
        progress: t.progress
      }))
    };

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
