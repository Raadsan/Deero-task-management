import { prisma } from "../lib/prisma.js";
import { generateCustomId } from "../lib/id-generator.js";

export const getAllTasks = async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      include: {
        user: true,
        clientTask: { include: { Client: { include: { clientSubService: { include: { subService: true } } } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getTaskById = async (req, res) => {
  const { id } = req.params;
  try {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        user: true,
        clientTask: { include: { Client: true } },
      },
    });
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createTask = async (req, res) => {
  const data = req.body;
  console.log("Creating Task with data:", data);
  try {
    const result = await prisma.$transaction(async (tx) => {
      console.log("Starting Task Transaction...");
      // Generate ID if not provided
      let taskId = data.id;
      if (!taskId) {
        console.log("No ID provided, generating one...");
        const idRes = await generateCustomId({ entityTybe: "tasks", prisma: tx });
        taskId = idRes.data || idRes;
      }
      console.log("Task ID:", taskId);

      const task = await tx.task.create({
        data: {
          id: taskId,
          description: data.description,
          status: data.status?.toLowerCase(),
          priority: data.priority?.toLowerCase(),
          department: data.department,
          deadline: new Date(data.deadline),
          assgineeId: data.assgineeId,
          supervisor: data.supervisor || "",
          progress: data.progress ? Number(data.progress) : 0,
        },
      });
      console.log("Task created in DB:", task.id);

      if (data.clientId) {
        console.log("Linking to client:", data.clientId);
        await tx.clientTask.create({
          data: {
            clientId: data.clientId,
            taskId: task.id,
          },
        });
      }

      return task;
    });

    console.log("Task Creation Success!");
    
    // Notify Assignee
    try {
      const assigneeId = result.assgineeId;
      const taskWithUser = await prisma.task.findUnique({
        where: { id: result.id },
        include: { user: true }
      });
      
      const notifId = Math.random().toString(36).substring(2, 15);
      await prisma.$executeRawUnsafe(
        `INSERT INTO notifications (id, taskId, taskName, assigneeName, deadline, type, userId, isSeen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        notifId,
        result.id,
        result.description.substring(0, 50) + "...",
        taskWithUser.user?.name || "User",
        result.deadline,
        "new-assignment",
        assigneeId,
        0
      );
      console.log("Assignee notification created");
    } catch (err) {
      console.error("Failed to create assignee notification:", err);
    }

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error("Create Task Error Full Details:", error);
    res.status(500).json({ success: false, error: error.message || "Internal Server Error" });
  }
};

export const updateTask = async (req, res) => {
  const { id } = req.params;
  const { description, status, priority, department, deadline, assgineeId, supervisor, progress } = req.body;
  try {
    // Get original task for comparison
    const originalTask = await prisma.task.findUnique({ 
      where: { id },
      include: { user: true }
    });

    const task = await prisma.task.update({
      where: { id },
      data: {
        description,
        status: status?.toLowerCase(),
        priority: priority?.toLowerCase(),
        department,
        deadline: deadline ? new Date(deadline) : undefined,
        assgineeId,
        supervisor,
        progress: progress !== undefined ? Number(progress) : undefined,
      },
      include: { user: true }
    });

    // Create notifications if progress or status changed
    if (originalTask && (originalTask.status !== task.status || originalTask.progress !== task.progress)) {
      const admins = await prisma.user.findMany({
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
    await prisma.task.delete({ where: { id } });
    res.json({ success: true, message: "Task deleted" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getMonthlyGraphData = async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    const fromDate = startDate ? new Date(startDate) : undefined;
    const toDate = endDate ? new Date(endDate) : undefined;
    if (toDate) toDate.setHours(23, 59, 59, 999);

    const where = {};
    if (fromDate || toDate) {
      where.createdAt = { gte: fromDate, lte: toDate };
    }

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
    const fromDate = startDate ? new Date(startDate) : undefined;
    const toDate = endDate ? new Date(endDate) : undefined;
    if (toDate) toDate.setHours(23, 59, 59, 999);

    const where = {};
    if (fromDate || toDate) {
      where.createdAt = { gte: fromDate, lte: toDate };
    }

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
    const fromDate = startDate ? new Date(startDate) : undefined;
    const toDate = endDate ? new Date(endDate) : undefined;
    if (toDate) toDate.setHours(23, 59, 59, 999);

    const where = {};
    if (fromDate || toDate) {
      where.createdAt = { gte: fromDate, lte: toDate };
    }

    const [totalTasks, completedTasks, pendingTasks, totalClients] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.count({ where: { ...where, status: "completed" } }),
      prisma.task.count({ where: { ...where, status: "pending" } }),
      prisma.client.count({ where: fromDate || toDate ? { createdAt: { gte: fromDate, lte: toDate } } : {} }),
    ]);

    res.json({
      success: true,
      data: [
        { title: "Total Tasks", totalTasks },
        { title: "Completed Tasks", totalTasks: completedTasks },
        { title: "Pending Tasks", totallPending: pendingTasks },
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
    const from = startDate ? new Date(startDate) : undefined;
    const to = endDate ? new Date(endDate) : undefined;
    const where = {
      assgineeId: userIdForTaskReport,
    };
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

    const user = await prisma.user.findUnique({ where: { id: userIdForTaskReport } });

    const data = {
      meta: {
        userName: user?.name || "Unknown User",
        userEmail: user?.email || "",
        period: startDate && endDate ? `From ${startDate} to ${endDate}` : "All Time",
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === "completed").length,
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
