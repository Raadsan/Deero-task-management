import { prisma } from "../lib/prisma.js";
import { generateCustomId } from "../lib/id-generator.js";

export const getAllTasks = async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      include: {
        user: true,
        supervisor: true,
        clientTask: { include: { Client: true } },
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
        supervisor: true,
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
          status: data.status,
          priority: data.priority,
          department: data.department,
          deadline: new Date(data.deadline),
          assgineeId: data.assgineeId,
          supervisorId: data.supervisorId,
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
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error("Create Task Error Full Details:", error);
    res.status(500).json({ success: false, error: error.message || "Internal Server Error" });
  }
};

export const updateTask = async (req, res) => {
  const { id } = req.params;
  const { description, status, priority, department, deadline, assgineeId, supervisorId } = req.body;
  try {
    const task = await prisma.task.update({
      where: { id },
      data: {
        description,
        status,
        priority,
        department,
        deadline: deadline ? new Date(deadline) : undefined,
        assgineeId,
        supervisorId,
      },
    });
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
