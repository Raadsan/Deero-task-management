import { prisma } from "../../../lib/prisma.js";
import { generateCustomId, generateProjectCode } from "../../../lib/id-generator.js";
import {
  clientBranchWhere,
  getScope,
  mergeWhere,
  projectBranchWhere,
  resolveWritableBranchId,
} from "../../../lib/portfolio-scope.js";
import {
  applyScheduledFeatures,
  evaluateScheduledTask,
  isScheduleManager,
  mergeScheduleChange,
  isHistoricalScheduledDate,
  pastScheduleError,
  PROJECT_REGISTRATION_SCHEDULE_OPTIONS,
  scheduleSignature,
  zonedNowParts,
} from "../../../lib/scheduled-task-window.js";
import { addDays, addMonths, buildMonthlyCycles, contractProjectType, firstMonthlyCycle, isoDate } from "../../../lib/project-cycles.js";
import { assertTransferPreservesTaskState } from "../../../lib/task-transfer.js";
import {
  fridayScheduleErrorForReschedule,
  fridayScheduleErrorForTask,
  normalizeCompanyWorkingDays,
  workingDatesFromRange,
} from "../../../lib/company-working-days.js";

const LIFECYCLE = new Set(["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED", "DRAFT"]);

function mapPriority(value) {
  const key = String(value ?? "medium").toLowerCase();
  if (key === "urgent" || key === "high") return "urgent";
  if (key === "low" || key === "normal") return "normal";
  return "medium";
}

function mapTaskStatus(value) {
  const key = String(value ?? "PENDING").toUpperCase();
  if (key === "COMPLETED") return "completed";
  if (key === "IN_PROGRESS" || key === "UNDER_REVIEW") return "in_progress";
  return "pending";
}

function workingDates(start, end, workingDays) {
  return workingDatesFromRange(start, end, workingDays);
}

function scheduleInstant(dateValue, timeValue) {
  const date = String(dateValue || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const match = /^(\d{2}):(\d{2})/.exec(String(timeValue || ""));
  const hours = match ? Number(match[1]) : 0;
  const minutes = match ? Number(match[2]) : 0;
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function validateTaskSlot(task) {
  const start = String(task.startTime || "");
  const end = String(task.endTime || "");
  if (start && end && end <= start) {
    return `End time must be later than start time for ${task.name || "a task"}`;
  }
  return "";
}

function projectTaskFields(task, assigneeId, projectId, cycleId, subIdByKey) {
  return {
    description: task.name || task.description || "Project task",
    priority: mapPriority(task.priority),
    department: "Projects",
    assgineeId: assigneeId,
    isPersonal: false,
    serviceInformation: [task.serviceName, task.name || task.description].filter(Boolean).join(" - "),
    deadline: null,
    startDate: scheduleInstant(task.scheduledDate, task.startTime),
    projectId,
    supervisor: "",
    features: {
      projectTask: true,
      projectStatus: task.status || "PENDING",
      serviceId: task.serviceId || null,
      serviceName: task.serviceName || null,
      subServiceName: task.subServiceName || null,
      subServiceId: subIdByKey.get(task.subServiceKey) || null,
      cycleId,
      isExtra: Boolean(task.isExtra),
      ...(task.extraReason ? { extraReason: String(task.extraReason).trim() } : {}),
      priorityLabel: task.priority || "medium",
      scheduledDate: task.scheduledDate ? String(task.scheduledDate).slice(0, 10) : null,
      startTime: task.startTime || null,
      endTime: task.endTime || null,
      scheduleNotes: task.notes || null,
    },
  };
}

function buildGeneratedTasks(body) {
  if (Array.isArray(body.tasks) && body.tasks.length) return body.tasks;
  const schedule = body.schedule ?? {};
  const start = schedule.startDate || body.startDate || new Date().toISOString();
  const end = schedule.endDate || body.endDate || start;
  const dates = workingDates(start, end, schedule.workingDays);
  const tasks = [];
  let cursor = 0;
  for (const service of body.services ?? []) {
    for (const sub of service.subServices ?? []) {
      const qty = Math.max(0, Number(sub.quantity) || 0);
      for (let i = 1; i <= qty; i += 1) {
        const date = dates[cursor % dates.length];
        cursor += 1;
        const name = `${sub.name} ${String(i).padStart(2, "0")}`;
        tasks.push({
          name,
          description: sub.description || name,
          serviceId: service.serviceId,
          serviceName: service.serviceName,
          subServiceName: sub.name,
          subServiceKey: sub.clientKey || sub.name,
          assigneeId: sub.assigneeId || null,
          scheduledDate: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
          priority: "medium",
          status: "PENDING",
          isExtra: false,
        });
      }
    }
  }
  return tasks;
}

export const getProjectSummary = async (req, res) => {
  try {
    const scope = getScope(req);
    const projects = await prisma.project.findMany({
      where: mergeWhere(projectBranchWhere(scope), { archived: false }),
      select: { lifecycleStatus: true, billingMode: true, status: true, isDraft: true },
    });
    const active = (p) => !p.isDraft && (p.lifecycleStatus === "ACTIVE" || p.status === "ACTIVE");
    res.json({
      success: true,
      data: {
        total: projects.filter((p) => !p.isDraft).length,
        active: projects.filter(active).length,
        monthly: projects.filter((p) => p.billingMode === "MONTHLY" && !p.isDraft).length,
        oneTime: projects.filter((p) => p.billingMode !== "MONTHLY" && !p.isDraft).length,
        completed: projects.filter((p) => p.lifecycleStatus === "COMPLETED" || p.status === "COMPLETED").length,
        onHold: projects.filter((p) => p.lifecycleStatus === "ON_HOLD").length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const registerProject = async (req, res) => {
  const data = req.body ?? {};
  try {
    const scope = getScope(req);
    const name = String(data.name ?? "").trim();
    if (!name) return res.status(400).json({ success: false, error: "Project name is required" });
    if (!data.clientId) return res.status(400).json({ success: false, error: "Client is required" });

    const client = await prisma.client.findFirst({
      where: mergeWhere({ id: data.clientId }, clientBranchWhere(scope)),
    });
    if (!client) return res.status(404).json({ success: false, error: "Client not found" });

    const portfolioId = resolveWritableBranchId(scope, data.portfolioId) ?? client.portfolioId ?? null;
    let billingMode = data.billingMode === "MONTHLY" ? "MONTHLY" : "ONE_TIME";
    const saved = data.id
      ? await prisma.project.findUnique({
          where: { id: String(data.id) },
          select: { billingMode: true, startDate: true, dueDate: true, isDraft: true, lifecycleStatus: true },
        })
      : null;
    const datesLocked = Boolean(saved && !saved.isDraft && saved.lifecycleStatus !== "DRAFT");
    if (data.contractId) {
      const contract = await prisma.contract.findFirst({
        where: { id: String(data.contractId), clientId: client.id },
        select: { contractType: true, paymentTerms: true, startDate: true, endDate: true, duration: true },
      });
      if (!contract) return res.status(400).json({ success: false, error: "Contract not found for this client" });
      const contractType = contractProjectType(contract);
      const contractStart = isoDate(contract.startDate);
      const contractEnd = contract.duration === "ENDLESS" ? "" : isoDate(contract.endDate);
      if (!contractStart) return res.status(400).json({ success: false, error: "The selected contract has no start date" });
      if (contractEnd && contractStart > contractEnd) {
        return res.status(400).json({ success: false, error: "The contract end date is before the start date" });
      }
      if (contractType !== "ONE_TIME" && contract.duration !== "ENDLESS" && !contractEnd) {
        return res.status(400).json({ success: false, error: "The selected contract has no end date" });
      }
      if (datesLocked && saved) {
        if (saved.billingMode !== contractType) {
          return res.status(400).json({ success: false, error: "The project type must match the selected contract" });
        }
        billingMode = saved.billingMode === "MONTHLY" ? "MONTHLY" : "ONE_TIME";
        data.startDate = saved.startDate;
        data.endDate = saved.dueDate;
      } else {
        if (data.billingMode && data.billingMode !== contractType) {
          return res.status(400).json({ success: false, error: "The project type must match the selected contract" });
        }
        const projectStart = isoDate(data.startDate);
        const projectEnd = isoDate(data.endDate);
        if (projectStart && projectStart !== contractStart) {
          return res.status(400).json({ success: false, error: "The project start date must match the contract start date" });
        }
        if (contractEnd && projectEnd && projectEnd !== contractEnd) {
          return res.status(400).json({ success: false, error: "The project end date must match the contract end date" });
        }
        billingMode = contractType;
        data.startDate = contractStart;
        data.endDate = contractEnd || null;
      }
      data.billingMode = billingMode;
    }
    const lifecycle = LIFECYCLE.has(data.lifecycleStatus) ? data.lifecycleStatus : "ACTIVE";
    const isDraft = Boolean(data.isDraft) || lifecycle === "DRAFT";
    const tasks = isDraft ? [] : buildGeneratedTasks(data);
    const existingTaskRows = data.id
      ? await prisma.task.findMany({ where: { projectId: String(data.id) }, select: { id: true, features: true } })
      : [];
    const savedSchedules = new Map(existingTaskRows.map((task) => {
      const features = task.features && typeof task.features === "object" ? task.features : {};
      return [task.id, scheduleSignature(features)];
    }));
    if (data.schedule && typeof data.schedule === "object") {
      data.schedule.workingDays = normalizeCompanyWorkingDays(data.schedule.workingDays);
    }
    const slotError = tasks.map((task) => {
      const timing = validateTaskSlot(task);
      if (timing) return timing;
      if (task.id && savedSchedules.get(String(task.id)) === scheduleSignature(task)) return "";
      const friday = fridayScheduleErrorForTask(task, savedSchedules, scheduleSignature);
      if (friday) return `${task.name || "A task"}: ${friday}`;
      const past = pastScheduleError(task, new Date(), PROJECT_REGISTRATION_SCHEDULE_OPTIONS);
      return past ? `${task.name || "A task"}: ${past}` : "";
    }).find(Boolean);
    if (slotError) return res.status(400).json({ success: false, error: slotError });
    const fallbackAssignee = scope.user?.id;
    if (!isDraft && tasks.some((task) => !task.assigneeId) && !fallbackAssignee) {
      return res.status(400).json({ success: false, error: "Assign an employee before saving tasks" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const id = data.id || (await generateCustomId({ entityTybe: "projects", prisma: tx }));
      const existing = data.id
        ? await tx.project.findUnique({ where: { id: data.id } })
        : null;
      const projectCode = existing?.projectCode || (await generateProjectCode(tx));
      const payload = {
        name,
        description: data.description?.trim() || null,
        billingMode,
        lifecycleStatus: isDraft ? "DRAFT" : lifecycle,
        status: lifecycle === "COMPLETED" ? "COMPLETED" : lifecycle === "CANCELLED" ? "CANCELLED" : "ACTIVE",
        startDate: data.startDate ? new Date(data.startDate) : null,
        dueDate: data.endDate ? new Date(data.endDate) : null,
        clientId: client.id,
        contractId: data.contractId || null,
        portfolioId,
        createdById: existing?.createdById ?? scope.user?.id ?? null,
        isDraft,
        archived: false,
        scheduleConfig: data.schedule ?? null,
        projectCode,
      };

      const project = existing
        ? await tx.project.update({ where: { id }, data: payload })
        : await tx.project.create({ data: { id, ...payload } });

      if (existing) {
        await tx.projectExtraRequest.deleteMany({ where: { projectId: id } });
        await tx.projectSubService.deleteMany({
          where: { link: { projectId: id } },
        });
        await tx.projectServiceLink.deleteMany({ where: { projectId: id } });
        if (!existing.isDraft) {
          // Keep historical tasks. New generation only appends when explicitly requested.
        } else {
          await tx.task.deleteMany({ where: { projectId: id } });
        }
      }

      const subIdByKey = new Map();
      for (const service of data.services ?? []) {
        if (!service.serviceId) continue;
        const linkId = await generateCustomId({ entityTybe: "services", prisma: tx });
        await tx.projectServiceLink.create({
          data: { id: linkId, projectId: project.id, serviceId: service.serviceId },
        });
        for (const sub of service.subServices ?? []) {
          if (!String(sub.name ?? "").trim()) continue;
          const subId = await generateCustomId({ entityTybe: "subservices", prisma: tx });
          await tx.projectSubService.create({
            data: {
              id: subId,
              projectServiceId: linkId,
              name: String(sub.name).trim(),
              description: sub.description?.trim() || null,
              quantity: Number(sub.quantity) || 1,
              unit: sub.unit?.trim() || "Items",
              targetQuantity: Number(sub.targetQuantity || sub.quantity) || 1,
              assigneeId: sub.assigneeId || null,
            },
          });
          subIdByKey.set(sub.clientKey || sub.name, subId);
        }
      }

      let cycleId = null;
      if (!isDraft && billingMode === "MONTHLY" && data.startDate) {
        const existingCycles = existing
          ? await tx.projectCycle.findMany({
              where: { projectId: project.id },
              orderBy: { startDate: "asc" },
            })
          : [];
        if (existingCycles.length) {
          cycleId = existingCycles[0].id;
        } else {
          const specs = data.contractId && data.endDate
            ? buildMonthlyCycles(data.startDate, data.endDate)
            : firstMonthlyCycle(data.startDate);
          for (const spec of specs) {
            const createdId = await generateCustomId({ entityTybe: "content_cycles", prisma: tx });
            await tx.projectCycle.create({
              data: {
                id: createdId,
                projectId: project.id,
                label: spec.label,
                startDate: new Date(`${spec.startDate}T00:00:00.000Z`),
                endDate: new Date(`${spec.endDate}T00:00:00.000Z`),
              },
            });
            if (!cycleId) cycleId = createdId;
          }
        }
      }

      const editingSaved = Boolean(existing && !existing.isDraft && !data.regenerateTasks);
      const shouldGenerate = !isDraft && !editingSaved;
      function historicalCompletedAt(task) {
        return (
          scheduleInstant(task.scheduledDate, task.endTime || task.startTime)
          || scheduleInstant(task.scheduledDate, task.startTime)
          || new Date(`${String(task.scheduledDate).slice(0, 10)}T23:59:00`)
        );
      }

      async function createProjectTask(task) {
        const taskId = await generateCustomId({ entityTybe: "tasks", prisma: tx });
        const assigneeId = task.assigneeId || fallbackAssignee;
        if (!assigneeId) return;
        const fields = projectTaskFields(task, assigneeId, project.id, cycleId, subIdByKey);
        const historical = isHistoricalScheduledDate(task.scheduledDate, new Date());
        if (historical) {
          const completedAt = historicalCompletedAt(task);
          const features = {
            ...fields.features,
            projectStatus: "COMPLETED",
          };
          await tx.task.create({
            data: {
              id: taskId,
              ...fields,
              status: "completed",
              progress: 100,
              completedAt,
              progressUpdatedAt: completedAt,
              startDate: fields.startDate || completedAt,
              features,
            },
          });
        } else {
          const evaluation = evaluateScheduledTask({ ...fields, progress: 0, status: "pending" }, new Date());
          await tx.task.create({
            data: {
              id: taskId,
              ...fields,
              status: evaluation.scheduled ? evaluation.status : mapTaskStatus(task.status),
              startDate: evaluation.startAt || fields.startDate,
              features: evaluation.scheduled ? applyScheduledFeatures(fields.features, evaluation) : fields.features,
            },
          });
        }
        await tx.clientTask.create({
          data: { clientId: client.id, taskId },
        });
      }

      if (editingSaved) {
        for (const task of tasks) {
          const assigneeId = task.assigneeId || fallbackAssignee;
          if (!assigneeId) continue;
          const current = task.id
            ? await tx.task.findFirst({ where: { id: String(task.id), projectId: project.id } })
            : null;
          if (!current) {
            await createProjectTask(task);
            continue;
          }
          const previousFeatures = current.features && typeof current.features === "object" ? current.features : {};
          const keptCycleId = previousFeatures.cycleId || cycleId;
          const nextFields = projectTaskFields(task, assigneeId, project.id, keptCycleId, subIdByKey);
          const mergedFeatures = mergeScheduleChange(previousFeatures, nextFields.features, current.status);
          const scheduleUnchanged =
            task.id && savedSchedules.get(String(task.id)) === scheduleSignature(task);
          const evaluation = evaluateScheduledTask({
            ...current,
            ...nextFields,
            features: mergedFeatures,
            progress: current.progress ?? 0,
          }, new Date());
          await tx.task.update({
            where: { id: current.id },
            data: {
              ...nextFields,
              progress: current.progress ?? 0,
              status: scheduleUnchanged
                ? current.status
                : evaluation.scheduled
                  ? evaluation.status
                  : current.status,
              startDate: scheduleUnchanged
                ? current.startDate
                : evaluation.startAt || nextFields.startDate,
              completedAt: current.completedAt,
              features: scheduleUnchanged
                ? {
                    ...previousFeatures,
                    ...nextFields.features,
                    projectStatus: previousFeatures.projectStatus || nextFields.features.projectStatus,
                  }
                : evaluation.scheduled
                  ? applyScheduledFeatures({ ...previousFeatures, ...mergedFeatures }, evaluation)
                  : {
                      ...previousFeatures,
                      ...nextFields.features,
                      projectStatus: previousFeatures.projectStatus || nextFields.features.projectStatus,
                    },
            },
          });
        }
      } else if (shouldGenerate) {
        for (const task of tasks) {
          await createProjectTask(task);
        }
      }

      return project;
    }, { timeout: 60000 });

    const full = await prisma.project.findUnique({
      where: { id: result.id },
      include: projectDetailInclude,
    });
    res.status(201).json({ success: true, data: full });
  } catch (error) {
    console.error("registerProject error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const projectDetailInclude = {
  client: { select: { id: true, institution: true } },
  primaryContract: {
    select: { id: true, contractNumber: true, title: true, duration: true, status: true, startDate: true, endDate: true },
  },
  serviceLinks: {
    include: {
      service: { select: { id: true, serviceName: true, serviceCode: true, isActive: true } },
      subServices: { include: { assignee: { select: { id: true, name: true } } } },
    },
  },
  cycles: { orderBy: { startDate: "asc" } },
  extraRequests: {
    orderBy: { createdAt: "desc" },
    include: {
      requestedBy: { select: { id: true, name: true } },
      subService: {
        include: {
          link: { include: { service: { select: { id: true, serviceName: true } } } },
        },
      },
    },
  },
  tasks: {
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
    include: {
      user: { select: { id: true, name: true } },
      transferHistory: {
        orderBy: { createdAt: "desc" },
        include: {
          fromAssignee: { select: { id: true, name: true } },
          toAssignee: { select: { id: true, name: true } },
          transferredBy: { select: { id: true, name: true } },
        },
      },
    },
  },
  createdBy: { select: { id: true, name: true } },
};

export const archiveProject = async (req, res) => {
  try {
    const scope = getScope(req);
    const existing = await prisma.project.findFirst({
      where: mergeWhere({ id: req.params.id }, projectBranchWhere(scope)),
    });
    if (!existing) return res.status(404).json({ success: false, error: "Project not found" });
    const project = await prisma.project.update({
      where: { id: existing.id },
      data: { archived: true, lifecycleStatus: "CANCELLED" },
    });
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const reassignProjectTask = async (req, res) => {
  const { taskId } = req.params;
  const { assigneeId, reason, note } = req.body ?? {};
  try {
    const scope = getScope(req);
    if (!assigneeId) return res.status(400).json({ success: false, error: "New employee is required" });
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task?.projectId) return res.status(404).json({ success: false, error: "Task not found" });
    const project = await prisma.project.findFirst({
      where: mergeWhere({ id: task.projectId }, projectBranchWhere(scope)),
    });
    if (!project) return res.status(404).json({ success: false, error: "Project not found" });
    if (task.assgineeId === assigneeId) {
      return res.status(400).json({ success: false, error: "Task is already assigned to this employee" });
    }
    if (String(task.status).toLowerCase() === "completed") {
      return res.status(400).json({ success: false, error: "Completed tasks cannot be reassigned" });
    }

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
          fromAssigneeId: task.assgineeId,
          toAssigneeId: assigneeId,
          progressAtTransfer: task.progress ?? 0,
          deadlineAtTransfer: task.deadline,
          transferredById: scope.user?.id ?? null,
          reason: reason || "Other",
          note: note || null,
        },
      });
      const row = await tx.task.update({
        where: { id: task.id },
        data: { assgineeId: assigneeId },
        include: { user: { select: { id: true, name: true } } },
      });
      const integrityError = assertTransferPreservesTaskState(snapshot, row);
      if (integrityError) throw new Error(integrityError);
      return row;
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const EXTRA_DECISION_MARK = "\n---extra-decision---\n";

function packExtraDescription(reason, decision) {
  const text = String(reason || "").trim();
  if (!decision) return text || null;
  return `${text}${EXTRA_DECISION_MARK}${JSON.stringify(decision)}`;
}

function unpackExtraDescription(description) {
  const [reason, raw] = String(description || "").split(EXTRA_DECISION_MARK);
  let decision = null;
  if (raw) {
    try { decision = JSON.parse(raw); } catch { decision = null; }
  }
  return { reason: reason.trim(), decision };
}

function taskFeatures(task) {
  return task?.features && typeof task.features === "object" ? task.features : {};
}

function nextExtraIndex(tasks, subServiceId) {
  let max = 0;
  for (const task of tasks) {
    const features = taskFeatures(task);
    if (!features.isExtra || String(features.subServiceId || "") !== String(subServiceId)) continue;
    const match = /(\d+)\s*$/.exec(String(task.description || ""));
    const value = match ? Number(match[1]) : 0;
    if (value > max) max = value;
  }
  return max + 1;
}

function cycleDay(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value || "").slice(0, 10);
  return zonedNowParts(parsed).date;
}

function currentCycleId(cycles, now = new Date()) {
  if (!cycles?.length) return null;
  const today = zonedNowParts(now).date;
  const open = cycles.find((cycle) => {
    const start = cycleDay(cycle.startDate);
    const end = cycleDay(cycle.endDate);
    return start && end && start <= today && today <= end;
  });
  if (open) return open.id;
  return [...cycles].sort((left, right) => cycleDay(right.endDate).localeCompare(cycleDay(left.endDate)))[0]?.id ?? null;
}

function requireManager(res, scope) {
  if (isScheduleManager(scope.user?.role)) return true;
  res.status(403).json({ success: false, error: "Only a manager can manage extra work" });
  return false;
}

export const createExtraRequest = async (req, res) => {
  const { id } = req.params;
  const { subServiceId, quantity, reason, description } = req.body ?? {};
  try {
    const scope = getScope(req);
    if (!requireManager(res, scope)) return;
    const count = Number(quantity);
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      return res.status(400).json({ success: false, error: "Extra quantity must be a whole number from 1 to 50" });
    }
    const requestReason = String(reason || description || "").trim();
    if (!requestReason) return res.status(400).json({ success: false, error: "A request reason is required" });

    const project = await prisma.project.findFirst({
      where: mergeWhere({ id }, projectBranchWhere(scope)),
      include: { serviceLinks: { include: { subServices: true } } },
    });
    if (!project) return res.status(404).json({ success: false, error: "Project not found" });
    const sub = project.serviceLinks.flatMap((link) => link.subServices).find((item) => item.id === subServiceId);
    if (!sub) return res.status(404).json({ success: false, error: "Sub service not found" });

    const requestId = await generateCustomId({ entityTybe: "content_requests" });
    const extra = await prisma.projectExtraRequest.create({
      data: {
        id: requestId,
        projectId: project.id,
        subServiceId: sub.id,
        quantity: count,
        description: packExtraDescription(requestReason),
        status: "PENDING",
        requestedById: scope.user?.id ?? null,
      },
      include: {
        requestedBy: { select: { id: true, name: true } },
        subService: { select: { id: true, name: true } },
      },
    });

    res.status(201).json({
      success: true,
      data: { ...extra, reason: requestReason, approvalStatus: extra.status },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const decideExtraRequest = async (req, res) => {
  const { id, requestId } = req.params;
  const { decision, assigneeId, scheduledDate, startTime, endTime } = req.body ?? {};
  try {
    const scope = getScope(req);
    if (!requireManager(res, scope)) return;
    const verdict = String(decision || "").toUpperCase();
    if (verdict !== "APPROVED" && verdict !== "REJECTED") {
      return res.status(400).json({ success: false, error: "Decision must be approved or rejected" });
    }

    const project = await prisma.project.findFirst({
      where: mergeWhere({ id }, projectBranchWhere(scope)),
      include: {
        tasks: { select: { id: true, description: true, features: true } },
        cycles: true,
        serviceLinks: { include: { service: true, subServices: true } },
      },
    });
    if (!project) return res.status(404).json({ success: false, error: "Project not found" });
    const extra = await prisma.projectExtraRequest.findFirst({
      where: { id: requestId, projectId: project.id },
    });
    if (!extra) return res.status(404).json({ success: false, error: "Extra work request not found" });
    if (extra.status !== "PENDING") {
      return res.status(400).json({ success: false, error: "This extra work request has already been decided" });
    }

    const sub = project.serviceLinks.flatMap((link) => link.subServices).find((item) => item.id === extra.subServiceId);
    const link = project.serviceLinks.find((item) => item.subServices.some((entry) => entry.id === extra.subServiceId));
    if (!sub) return res.status(404).json({ success: false, error: "Sub service not found" });
    const { reason } = unpackExtraDescription(extra.description);
    const decisionRecord = {
      decision: verdict,
      decidedById: scope.user?.id ?? null,
      decidedByName: scope.user?.name ?? null,
      decidedAt: new Date().toISOString(),
      taskIds: [],
    };

    if (verdict === "REJECTED") {
      const updated = await prisma.projectExtraRequest.update({
        where: { id: extra.id },
        data: { status: "REJECTED", description: packExtraDescription(reason, decisionRecord) },
      });
      return res.json({ success: true, data: { ...updated, reason, decision: decisionRecord } });
    }

    const date = String(scheduledDate || "").slice(0, 10);
    const start = String(startTime || "").slice(0, 5);
    const end = String(endTime || "").slice(0, 5);
    const hasSchedule = Boolean(date || start || end);
    if (hasSchedule && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end))) {
      return res.status(400).json({ success: false, error: "Scheduled date, start time, and end time are all required" });
    }
    if (hasSchedule) {
      const friday = fridayScheduleErrorForReschedule(null, { scheduledDate: date });
      if (friday) return res.status(400).json({ success: false, error: friday });
      const past = pastScheduleError({ scheduledDate: date, startTime: start, endTime: end });
      if (past) return res.status(400).json({ success: false, error: past });
    }
    const workerId = assigneeId || sub.assigneeId || null;
    if (!workerId) return res.status(400).json({ success: false, error: "Choose an employee for the extra tasks" });
    const worker = await prisma.staff.findUnique({ where: { id: workerId }, select: { id: true } });
    if (!worker) return res.status(404).json({ success: false, error: "Employee not found" });

    const cycleId = project.billingMode === "MONTHLY" ? currentCycleId(project.cycles) : null;
    let index = nextExtraIndex(project.tasks, sub.id);
    const created = await prisma.$transaction(async (tx) => {
      const taskIds = [];
      for (let i = 0; i < extra.quantity; i += 1) {
        const taskId = await generateCustomId({ entityTybe: "tasks", prisma: tx });
        const label = `Extra ${sub.name} ${String(index).padStart(2, "0")}`;
        index += 1;
        const features = {
          projectTask: true,
          projectStatus: "PENDING",
          isExtra: true,
          subServiceId: sub.id,
          subServiceName: sub.name,
          serviceId: link?.service?.id || link?.serviceId || null,
          serviceName: link?.service?.serviceName || null,
          extraRequestId: extra.id,
          cycleId,
          scheduledDate: hasSchedule ? date : null,
          startTime: hasSchedule ? start : null,
          endTime: hasSchedule ? end : null,
        };
        const evaluation = evaluateScheduledTask({ features, progress: 0, status: "pending" }, new Date());
        await tx.task.create({
          data: {
            id: taskId,
            description: label,
            status: evaluation.scheduled ? evaluation.status : "pending",
            progress: 0,
            priority: "medium",
            department: "Projects",
            assgineeId: workerId,
            projectId: project.id,
            supervisor: "",
            startDate: evaluation.startAt,
            features: evaluation.scheduled ? applyScheduledFeatures(features, evaluation) : features,
          },
        });
        if (project.clientId) {
          await tx.clientTask.create({ data: { clientId: project.clientId, taskId } });
        }
        taskIds.push(taskId);
      }
      decisionRecord.taskIds = taskIds;
      await tx.projectExtraRequest.update({
        where: { id: extra.id },
        data: { status: "APPROVED", description: packExtraDescription(reason, decisionRecord) },
      });
      return taskIds;
    });
    res.json({ success: true, data: { id: extra.id, status: "APPROVED", reason, decision: decisionRecord, taskIds: created } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const startNextCycle = async (req, res) => {
  const { id } = req.params;
  try {
    const scope = getScope(req);
    const project = await prisma.project.findFirst({
      where: mergeWhere({ id }, projectBranchWhere(scope)),
      include: {
        cycles: { orderBy: { startDate: "asc" } },
        primaryContract: { select: { endDate: true, duration: true } },
        tasks: { select: { features: true } },
        serviceLinks: { include: { subServices: true, service: true } },
      },
    });
    if (!project) return res.status(404).json({ success: false, error: "Project not found" });
    if (project.billingMode !== "MONTHLY") {
      return res.status(400).json({ success: false, error: "Only monthly projects have cycles" });
    }
    const usedCycleIds = new Set(project.tasks.map((task) => {
      const features = task.features && typeof task.features === "object" ? task.features : {};
      return features.cycleId ? String(features.cycleId) : "";
    }).filter(Boolean));
    const empty = project.cycles.find((cycle) => !usedCycleIds.has(cycle.id));
    let cycleId = empty?.id ?? "";
    let created = false;
    let start = empty ? new Date(empty.startDate) : null;
    let end = empty ? new Date(empty.endDate) : null;
    if (!empty) {
      const contractEnd = project.primaryContract?.duration === "ENDLESS"
        ? ""
        : isoDate(project.primaryContract?.endDate || project.dueDate);
      const last = project.cycles[project.cycles.length - 1];
      const nextStart = last ? addDays(isoDate(last.endDate), 1) : isoDate(project.startDate);
      if (!nextStart) return res.status(400).json({ success: false, error: "The project has no start date" });
      if (contractEnd && nextStart > contractEnd) {
        return res.status(400).json({ success: false, error: "All monthly cycles for this contract already exist" });
      }
      if (project.cycles.some((cycle) => isoDate(cycle.startDate) === nextStart)) {
        return res.status(400).json({ success: false, error: "That monthly cycle already exists" });
      }
      let nextEnd = addDays(addMonths(nextStart, 1), -1);
      if (contractEnd && nextEnd > contractEnd) nextEnd = contractEnd;
      start = new Date(`${nextStart}T00:00:00.000Z`);
      end = new Date(`${nextEnd}T00:00:00.000Z`);
      cycleId = await generateCustomId({ entityTybe: "content_cycles" });
      created = true;
      await prisma.projectCycle.create({
        data: {
          id: cycleId,
          projectId: project.id,
          label: `Month ${project.cycles.length + 1}`,
          startDate: start,
          endDate: end,
        },
      });
    }
    const today = zonedNowParts(new Date()).date;
    const startIso = isoDate(start);
    for (const link of project.serviceLinks) {
      for (const sub of link.subServices) {
        for (let i = 1; i <= sub.quantity; i += 1) {
          const assigneeId = sub.assigneeId || scope.user?.id;
          if (!assigneeId) continue;
          const taskId = await generateCustomId({ entityTybe: "tasks" });
          await prisma.task.create({
            data: {
              id: taskId,
              description: `${sub.name} ${String(i).padStart(2, "0")}`,
              status: "pending",
              priority: "medium",
              department: "Projects",
              assgineeId: assigneeId,
              startDate: start,
              deadline: null,
              projectId: project.id,
              supervisor: "",
              features: {
                projectTask: true,
                projectStatus: "PENDING",
                cycleId,
                serviceName: link.service.serviceName,
                subServiceId: sub.id,
                subServiceName: sub.name,
                isExtra: false,
                scheduledDate: startIso >= today ? startIso : null,
                startTime: null,
                endTime: null,
              },
            },
          });
        }
      }
    }
    res.json({ success: true, data: { cycleId, created } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
