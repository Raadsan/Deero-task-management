import { prisma } from "../lib/prisma.js";
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
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getMyTasks = async (req, res) => {
  try {
    const scope = getScope(req);
    const userId = scope.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const taskScope = String(req.query.scope ?? "personal").toLowerCase();
    const where = { assgineeId: userId };

    if (taskScope === "personal") {
      where.isPersonal = true;
    } else if (taskScope === "company") {
      where.isPersonal = false;
    }
    // scope=all → every task assigned to this user

    const tasks = await prisma.task.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, portfolioId: true } },
        clientTask: {
          include: {
            Client: { select: { id: true, institution: true } },
          },
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
      include,
    });
    if (ownTask) return ownTask;
  }

  return prisma.task.findFirst({
    where: mergeWhere({ id: taskId }, taskBranchWhere(scope)),
    include,
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
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createTask = async (req, res) => {
  const data = req.body;
  try {
    const scope = getScope(req);
    const assignee = await prisma.staff.findUnique({
      where: { id: data.assgineeId },
      select: { id: true, portfolioId: true },
    });
    if (!assignee) {
      return res.status(400).json({ success: false, error: "Assignee not found" });
    }
    if (denyIfOutOfScope(res, scope, assignee.portfolioId)) return;

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

    let taskId = data.id;
    if (!taskId) {
      taskId = await generateCustomId({ entityTybe: "tasks" });
    }

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
      assgineeId: data.assgineeId,
      supervisor: data.supervisor || "",
      progress: normalized.progress,
      serviceInformation: data.serviceInformation || "",
      isPersonal: Boolean(data.isPersonal),
    };

    // Personal / simple tasks: single insert (no transaction — avoids remote DB timeouts)
    if (!data.clientId) {
      const result = await prisma.task.create({ data: taskData });
      res.status(201).json({ success: true, data: result });
      if (!data.isPersonal) {
        void notifyTaskAssignee(result).catch((err) => {
          console.error("Failed to create assignee notification:", err);
        });
      }
      return;
    }

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

    res.status(201).json({ success: true, data: result });
    void notifyTaskAssignee(result).catch((err) => {
      console.error("Failed to create assignee notification:", err);
    });
  } catch (error) {
    console.error("Create Task Error:", error);
    const message = error.message || "Internal Server Error";
    const statusCode = message.includes("completed") ? 400 : 500;
    res.status(statusCode).json({ success: false, error: message });
  }
};

async function notifyTaskAssignee(result) {
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
}

export const updateTask = async (req, res) => {
  const { id } = req.params;
  const { description, status, priority, department, deadline, assgineeId, supervisor, progress, serviceInformation } = req.body;
  try {
    const scope = getScope(req);
    const originalTask = await findAccessibleTask(scope, id, { user: true });

    if (!originalTask) {
      return res.status(404).json({ success: false, error: "Task not found" });
    }

    const normalized = normalizeTaskWriteStatus({
      status,
      progress,
      deadline,
      currentStatus: originalTask.status,
      currentProgress: originalTask.progress,
    });

    if (normalized.error) {
      return res.status(400).json({ success: false, error: normalized.error });
    }

    if (assgineeId) {
      const assignee = await prisma.staff.findUnique({
        where: { id: assgineeId },
        select: { id: true, portfolioId: true },
      });
      if (!assignee) {
        return res.status(400).json({ success: false, error: "Assignee not found" });
      }
      if (denyIfOutOfScope(res, scope, assignee.portfolioId)) return;
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(description !== undefined ? { description } : {}),
        status: normalized.status,
        ...(priority !== undefined ? { priority: priority?.toLowerCase() } : {}),
        ...(department !== undefined ? { department } : {}),
        ...(deadline !== undefined
          ? { deadline: deadline ? new Date(deadline) : null }
          : {}),
        ...(assgineeId !== undefined ? { assgineeId } : {}),
        ...(supervisor !== undefined ? { supervisor } : {}),
        progress: normalized.progress,
        ...(serviceInformation !== undefined ? { serviceInformation } : {}),
      },
      include: { user: true }
    });

    // Create notifications if progress or status changed
    if (originalTask && (originalTask.status !== task.status || originalTask.progress !== task.progress)) {
      const admins = await prisma.staff.findMany({
        where: {
          role: { in: ["admin", "superadmin"] }
        }
      });

      if (admins.length > 0) {
        for (const admin of admins) {
          try {
            const notifId = Math.random().toString(36).substring(2, 15);
            await prisma.$executeRawUnsafe(
              `INSERT INTO notifications (id, taskId, taskName, assigneeName, deadline, type, userId, isSeen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              notifId,
              task.id,
              task.description.substring(0, 50) + "...",
              task.user?.name || "Unknown",
              task.deadline,
              "task-updated",
              admin.id,
              0
            );
          } catch (err) {
            console.error("Failed to create notification for admin:", admin.id, err);
          }
        }
      }
    }

    // Notify New Assignee if changed
    if (originalTask && originalTask.assgineeId !== task.assgineeId) {
      try {
        const notifId = Math.random().toString(36).substring(2, 15);
        await prisma.$executeRawUnsafe(
          `INSERT INTO notifications (id, taskId, taskName, assigneeName, deadline, type, userId, isSeen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          notifId,
          task.id,
          task.description.substring(0, 50) + "...",
          task.user?.name || "User",
          task.deadline,
          "new-assignment",
          task.assgineeId,
          0
        );
        console.log("New assignee notification created");
      } catch (err) {
        console.error("Failed to create new assignee notification:", err);
      }
    }

    res.json({ success: true, data: task });
  } catch (error) {
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
        { title: "Pending Tasks", totallPending: pendingTasks },
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
