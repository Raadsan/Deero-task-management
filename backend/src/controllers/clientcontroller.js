import { prisma } from "../lib/prisma.js";
import { generateCustomId } from "../lib/id-generator.js";
import {
  clientBranchWhere,
  denyIfOutOfScope,
  getScope,
  mergeWhere,
  resolveWritableBranchId,
} from "../lib/portfolio-scope.js";
import {
  findWorkflowTemplate,
  generateTasksFromTemplate,
  resolveWorkflowAssignee,
} from "../lib/workflow-automation.js";
import { generateDailyRecurringTasks } from "../lib/recurring-task-generator.js";

function mapClientError(error) {
  if (error?.code === "P2002") {
    const target = String(error?.meta?.target ?? "");
    if (target.includes("email")) {
      return {
        status: 409,
        message: "This email is already used by another client. Use a different email or leave it blank.",
      };
    }
    if (target.includes("phone")) {
      return {
        status: 409,
        message: "This phone number is already used by another client.",
      };
    }
    return { status: 409, message: "A client with these details already exists." };
  }

  return { status: 500, message: error?.message || "Internal Server Error" };
}

async function attachClientServiceAgreement(tx, {
  clientId,
  serviceName,
  subServiceName,
  base,
  description,
  discount,
  portfolioId,
  createdAt,
  serviceStatus,
  contractFeatures,
  discountType = "PERCENTAGE",
}) {
  const serviceWhere = { serviceName };
  if (portfolioId) {
    serviceWhere.portfolioId = portfolioId;
  }

  let service = await tx.service.findFirst({ where: serviceWhere });
  if (!service) {
    const serviceId = await generateCustomId({ entityTybe: "services", prisma: tx });
    service = await tx.service.create({
      data: {
        id: serviceId.data || serviceId,
        serviceName,
        portfolioId: portfolioId || null,
      },
    });
  }

  const existingClientService = await tx.clientService.findUnique({
    where: {
      serviceId_clientId: {
        serviceId: service.id,
        clientId,
      },
    },
  });

  if (!existingClientService) {
    await tx.clientService.create({
      data: { clientId, serviceId: service.id },
    });
  }

  let subService = await tx.subService.findFirst({
    where: { name: subServiceName, categoryId: service.id },
  });
  if (!subService) {
    const subServiceId = await generateCustomId({ entityTybe: "subservices", prisma: tx });
    subService = await tx.subService.create({
      data: {
        id: subServiceId.data || subServiceId,
        name: subServiceName,
        categoryId: service.id,
      },
    });
  }

  const existingClientSubService = await tx.clientSubService.findUnique({
    where: {
      subServiceId_clientId: {
        subServiceId: subService.id,
        clientId,
      },
    },
  });

  if (existingClientSubService) {
    await tx.clientSubService.update({
      where: {
        subServiceId_clientId: {
          subServiceId: subService.id,
          clientId,
        },
      },
      data: { count: existingClientSubService.count + 1 },
    });
  } else {
    await tx.clientSubService.create({
      data: { clientId, subServiceId: subService.id, count: 1 },
    });
  }

  const agreement = await tx.incomeServiceAgreement.create({
    data: {
      clientId,
      serviceId: service.id,
      subServiceId: subService.id,
      base: Number(base),
      description: description || "",
      discount: Number(discount) || 0,
      packageSnapshot: {
        externalId: subService.externalId,
        name: subService.name,
        price: subService.price,
        currency: subService.currency,
        features: subService.features || [],
      },
      contractFeatures: Array.isArray(contractFeatures)
        ? contractFeatures
        : Array.isArray(subService.features)
        ? subService.features.map((feature) => ({
            name: String(feature),
            quantity: 1,
            frequency: "",
            description: "",
          }))
        : [],
      discountType: "PERCENTAGE",
      ...(discountType ? { discountType } : {}),
      discountValue: Number(discount) || 0,
      discountAmount: Number(base) * (Number(discount) || 0),
      finalAmount: Number(base) - Number(base) * (Number(discount) || 0),
      serviceStatus: serviceStatus === "completed" ? "completed" : "pending",
      ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
    },
  });

  return { service, subService, agreement };
}

const clientListInclude = {
  clientService: {
    include: {
      service: { include: { portfolio: { select: { id: true, name: true } } } },
    },
  },
  clientSubService: { include: { subService: true } },
  serviceAgreements: {
    include: {
      service: { include: { portfolio: { select: { id: true, name: true } } } },
      subService: true,
    },
    orderBy: { createdAt: "desc" },
  },
};

export const getAllClients = async (req, res) => {
  try {
    const scope = getScope(req);
    const portfolioFilter = scope.seesAllBranches ? "" : "WHERE c.portfolioId = ?";
    const params = scope.seesAllBranches ? [] : [scope.portfolioId];
    const rows = await prisma.$queryRawUnsafe(
      `SELECT
         c.id, c.createdAt, c.updatedAt, c.institution, c.companyName,
         c.contactPerson, c.email, c.phone, c.address, c.source, c.clientType,
         c.contractStartDate, c.contractEndDate, c.monthlyBudget, c.notes,
         c.isActive, c.isDraft, c.portfolioId,
         a.id agreementId, a.createdAt agreementCreatedAt, a.base,
         a.discount, a.description agreementDescription, a.serviceStatus,
         a.serviceId, a.subServiceId,
         s.serviceName, s.portfolioId servicePortfolioId,
         ss.name subServiceName,
         p.id servicePortfolioRecordId, p.name servicePortfolioName
       FROM clients c
       LEFT JOIN IncomeServiceAgreement a ON a.clientId = c.id
       LEFT JOIN services s ON s.id = a.serviceId
       LEFT JOIN subservices ss ON ss.id = a.subServiceId
       LEFT JOIN portfolios p ON p.id = s.portfolioId
       ${portfolioFilter}
       ORDER BY c.createdAt DESC, a.createdAt DESC`,
      ...params,
    );

    const clientMap = new Map();
    for (const row of rows) {
      let client = clientMap.get(row.id);
      if (!client) {
        client = {
          id: row.id,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          institution: row.institution,
          companyName: row.companyName,
          contactPerson: row.contactPerson,
          email: row.email,
          phone: row.phone,
          address: row.address,
          source: row.source,
          clientType: row.clientType,
          contractStartDate: row.contractStartDate,
          contractEndDate: row.contractEndDate,
          monthlyBudget: row.monthlyBudget,
          notes: row.notes,
          isActive: Boolean(row.isActive),
          isDraft: Boolean(row.isDraft),
          portfolioId: row.portfolioId,
          clientService: [],
          serviceAgreements: [],
        };
        clientMap.set(row.id, client);
      }
      if (!row.agreementId) continue;
      const portfolio = row.servicePortfolioRecordId
        ? { id: row.servicePortfolioRecordId, name: row.servicePortfolioName }
        : null;
      const service = {
        id: row.serviceId,
        serviceName: row.serviceName,
        portfolioId: row.servicePortfolioId,
        portfolio,
      };
      if (!client.clientService.some((item) => item.service.id === service.id)) {
        client.clientService.push({ service });
      }
      client.serviceAgreements.push({
        id: row.agreementId,
        createdAt: row.agreementCreatedAt,
        base: row.base,
        discount: row.discount,
        description: row.agreementDescription,
        serviceStatus: row.serviceStatus,
        serviceId: row.serviceId,
        subServiceId: row.subServiceId,
        service,
        subService: { id: row.subServiceId, name: row.subServiceName },
      });
    }
    const clients = [...clientMap.values()];
    res.json({ success: true, data: clients });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getBasicClients = async (req, res) => {
  try {
    const scope = getScope(req);
    const clients = await prisma.client.findMany({
      where: clientBranchWhere(scope),
      select: {
        id: true,
        institution: true,
        phone: true,
        email: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: clients });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getClientById = async (req, res) => {
  const { id } = req.params;
  try {
    const scope = getScope(req);
    const client = await prisma.client.findFirst({
      where: mergeWhere({ id }, clientBranchWhere(scope)),
      include: {
        ...clientListInclude,
        clientTask: { include: { task: { include: { user: true } } } },
      },
    });
    if (!client) return res.status(404).json({ success: false, message: "Client not found" });
    res.json({ success: true, data: client });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createClient = async (req, res) => {
  const data = req.body;
  try {
    const scope = getScope(req);
    const scopedBranchId = resolveWritableBranchId(scope, data.portfolioId);
    const clientType = data.clientType ?? "ONE_TIME";
    const isDraft = data.isDraft === true;
    const draftToken = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

    const institution = String(data.institution ?? "").trim() || (isDraft ? "Draft client" : "");
    if (!institution) {
      return res.status(400).json({ success: false, error: "Client name is required" });
    }

    const phone =
      String(data.phone ?? "").trim() || (isDraft ? `DRAFT${draftToken}` : "");
    if (!phone) {
      return res.status(400).json({ success: false, error: "Phone is required" });
    }

    const email =
      String(data.email ?? "").trim() ||
      (isDraft && !data.phone?.trim()
        ? `draft-${draftToken}@deero.internal`
        : `client-${phone.replace(/\D/g, "")}@deero.so`);

    if (!isDraft) {
      const duplicateEmail = await prisma.client.findFirst({
        where: { email, isDraft: false },
        select: { id: true, institution: true },
      });
      if (duplicateEmail) {
        return res.status(409).json({
          success: false,
          error: `This email is already used by "${duplicateEmail.institution}". Use a different email or leave it blank.`,
        });
      }

      const duplicatePhone = await prisma.client.findFirst({
        where: { phone, isDraft: false },
        select: { id: true, institution: true },
      });
      if (duplicatePhone) {
        return res.status(409).json({
          success: false,
          error: `This phone number is already used by "${duplicatePhone.institution}".`,
        });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const id = await generateCustomId({ entityTybe: "clients", prisma: tx });

      const client = await tx.client.create({
        data: {
          id,
          institution,
          companyName: data.companyName ?? null,
          contactPerson: data.contactPerson ?? null,
          address: data.address ?? null,
          email,
          phone,
          source: data.source || (isDraft ? "Draft" : ""),
          clientType,
          contractStartDate: data.contractStartDate
            ? new Date(data.contractStartDate)
            : null,
          contractEndDate: data.contractEndDate
            ? new Date(data.contractEndDate)
            : null,
          monthlyBudget:
            data.monthlyBudget !== undefined && data.monthlyBudget !== null
              ? Number(data.monthlyBudget)
              : null,
          notes: data.notes ?? null,
          portfolioId: scopedBranchId ?? null,
          accountManagerId: data.accountManagerId ?? scope.user?.id ?? null,
          isActive: data.isActive !== false,
          isDraft,
          ...(data.createdAt ? { createdAt: new Date(data.createdAt) } : {}),
        },
      });

      let agreement = null;
      const hasService =
        data.serviceName && data.subServiceName && data.base !== undefined;

      if (hasService) {
        const attached = await attachClientServiceAgreement(tx, {
          clientId: client.id,
          serviceName: data.serviceName,
          subServiceName: data.subServiceName,
          base: data.base,
          description: data.description,
          discount: data.discount,
          portfolioId: scopedBranchId,
          createdAt: data.createdAt,
          serviceStatus: data.serviceStatus,
          contractFeatures: data.contractFeatures,
          discountType: data.discountType,
        });
        agreement = attached.agreement;
      }

      let project = null;
      let projectTasks = [];
      const projectPayload = data.project ?? (clientType === "ONE_TIME" && data.projectName
        ? {
            name: data.projectName,
            projectType: data.projectType,
            dueDate: data.dueDate,
            description: data.description,
          }
        : null);

      if (clientType === "ONE_TIME" && projectPayload?.name) {
        const projectId = await generateCustomId({ entityTybe: "projects", prisma: tx });
        project = await tx.project.create({
          data: {
            id: projectId,
            name: String(projectPayload.name).trim(),
            description: projectPayload.description ?? data.description ?? null,
            projectType: projectPayload.projectType ?? data.projectType ?? "OTHER",
            status: projectPayload.status ?? "LEAD",
            priority: projectPayload.priority ?? "medium",
            startDate: projectPayload.startDate
              ? new Date(projectPayload.startDate)
              : null,
            dueDate: projectPayload.dueDate
              ? new Date(projectPayload.dueDate)
              : data.dueDate
                ? new Date(data.dueDate)
                : null,
            clientId: client.id,
            portfolioId: scopedBranchId ?? null,
            createdById: scope.user?.id ?? null,
          },
        });

        if (agreement) {
          await tx.incomeServiceAgreement.update({
            where: { id: agreement.id },
            data: { projectId: project.id },
          });
        }

        if (data.autoGenerateTasks !== false) {
          const template = await findWorkflowTemplate(
            { clientType: "ONE_TIME", contentType: project.projectType },
            tx,
          );
          const assigneeId = await resolveWorkflowAssignee(
            {
              assigneeId: data.assigneeId,
              accountManagerId: client.accountManagerId,
              fallbackUserId: scope.user?.id,
            },
            tx,
          );
          if (template && assigneeId) {
            projectTasks = await generateTasksFromTemplate(tx, {
              template,
              clientId: client.id,
              assigneeId,
              projectId: project.id,
              agreementId: agreement?.id ?? null,
              startDate: project.startDate ?? new Date(),
              serviceInformation: project.name,
            });
          }
        }
      }

      let schedule = null;
      if (clientType === "MANAGED_RECURRING" && data.schedule) {
        const scheduleId = await generateCustomId({
          entityTybe: "recurring_schedules",
          prisma: tx,
        });
        schedule = await tx.recurringSchedule.create({
          data: {
            id: scheduleId,
            name: data.schedule.name ?? `${client.institution} schedule`,
            recurrenceType: data.schedule.recurrenceType ?? "WEEKLY",
            customRule: data.schedule.customRule ?? null,
            contentType: data.schedule.contentType ?? "VIDEO",
            startDate: new Date(data.schedule.startDate ?? Date.now()),
            endDate: data.schedule.endDate
              ? new Date(data.schedule.endDate)
              : null,
            clientId: client.id,
            portfolioId: scopedBranchId ?? null,
            steps: {
              create: (data.schedule.steps ?? []).map((step, index) => ({
                dayOfWeek: step.dayOfWeek ?? null,
                dayOfMonth: step.dayOfMonth ?? null,
                intervalDays: step.intervalDays ?? null,
                stepOrder: step.stepOrder ?? index + 1,
                label: step.label ?? `Step ${index + 1}`,
                contentType: step.contentType ?? null,
                department: step.department ?? null,
                supervisor: step.supervisor ?? "",
                assigneeId: step.assigneeId ?? data.assigneeId ?? null,
              })),
            },
          },
          include: { steps: true },
        });
      }

      let recurringDailyGeneration = null;
      if (schedule && data.autoGenerateTasks !== false) {
        recurringDailyGeneration = await generateDailyRecurringTasks({
          runDate: new Date(),
          scheduleId: schedule.id,
          tx,
        });
      }

      return {
        client,
        agreement,
        project,
        projectTasks,
        schedule,
        recurringDailyGeneration,
      };
    }, {
      timeout: 20000,
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error("Create Client Error:", error);
    const mapped = mapClientError(error);
    res.status(mapped.status).json({ success: false, error: mapped.message });
  }
};

export const addClientService = async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  try {
    const scope = getScope(req);
    const scopedBranchId = resolveWritableBranchId(scope, data.portfolioId);
    const client = await prisma.client.findFirst({
      where: mergeWhere({ id }, clientBranchWhere(scope)),
    });
    if (!client) {
      return res.status(404).json({ success: false, error: "Client not found" });
    }

    const result = await prisma.$transaction(async (tx) => {
      return attachClientServiceAgreement(tx, {
        clientId: id,
        serviceName: data.serviceName,
        subServiceName: data.subServiceName,
        base: data.base,
        description: data.description,
        discount: data.discount,
        portfolioId: scopedBranchId,
        createdAt: data.createdAt,
        serviceStatus: data.serviceStatus,
        contractFeatures: data.contractFeatures,
        discountType: data.discountType,
      });
    }, { timeout: 10000 });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error("Add Client Service Error:", error);
    res.status(500).json({ success: false, error: error.message || "Internal Server Error" });
  }
};

export const updateClient = async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  try {
    const scope = getScope(req);
    const existing = await prisma.client.findFirst({
      where: mergeWhere({ id }, clientBranchWhere(scope)),
      select: { id: true, email: true, phone: true, isDraft: true },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Client not found" });
    }

    const finalizing = existing.isDraft && data.isDraft === false;
    const nextEmail =
      data.email !== undefined ? String(data.email).trim() || existing.email : undefined;
    const nextPhone =
      data.phone !== undefined ? String(data.phone).trim() || existing.phone : undefined;

    if (finalizing) {
      if (nextEmail) {
        const duplicateEmail = await prisma.client.findFirst({
          where: { email: nextEmail, isDraft: false, NOT: { id } },
          select: { institution: true },
        });
        if (duplicateEmail) {
          return res.status(409).json({
            success: false,
            error: `This email is already used by "${duplicateEmail.institution}".`,
          });
        }
      }
      if (nextPhone) {
        const duplicatePhone = await prisma.client.findFirst({
          where: { phone: nextPhone, isDraft: false, NOT: { id } },
          select: { institution: true },
        });
        if (duplicatePhone) {
          return res.status(409).json({
            success: false,
            error: `This phone number is already used by "${duplicatePhone.institution}".`,
          });
        }
      }
    }

    const client = await prisma.client.update({
      where: { id },
      data: {
        ...(data.institution !== undefined ? { institution: data.institution } : {}),
        ...(data.companyName !== undefined ? { companyName: data.companyName } : {}),
        ...(data.contactPerson !== undefined ? { contactPerson: data.contactPerson } : {}),
        ...(data.address !== undefined ? { address: data.address } : {}),
        ...(nextEmail !== undefined ? { email: nextEmail } : {}),
        ...(nextPhone !== undefined ? { phone: nextPhone } : {}),
        ...(data.source !== undefined ? { source: data.source } : {}),
        ...(data.clientType !== undefined ? { clientType: data.clientType } : {}),
        ...(data.contractStartDate !== undefined
          ? {
              contractStartDate: data.contractStartDate
                ? new Date(data.contractStartDate)
                : null,
            }
          : {}),
        ...(data.contractEndDate !== undefined
          ? {
              contractEndDate: data.contractEndDate
                ? new Date(data.contractEndDate)
                : null,
            }
          : {}),
        ...(data.monthlyBudget !== undefined
          ? { monthlyBudget: data.monthlyBudget !== null ? Number(data.monthlyBudget) : null }
          : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.portfolioId !== undefined ? { portfolioId: data.portfolioId } : {}),
        ...(data.accountManagerId !== undefined
          ? { accountManagerId: data.accountManagerId }
          : {}),
        ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {}),
        ...(data.isDraft !== undefined ? { isDraft: Boolean(data.isDraft) } : {}),
        ...(data.createdAt ? { createdAt: new Date(data.createdAt) } : {}),
      },
    });

    if (data.discount !== undefined) {
      await prisma.incomeServiceAgreement.updateMany({
        where: { clientId: id },
        data: { discount: Number(data.discount) },
      });
    }

    res.json({ success: true, data: client });
  } catch (error) {
    const mapped = mapClientError(error);
    res.status(mapped.status).json({ success: false, error: mapped.message });
  }
};

export const deleteClientAgreement = async (req, res) => {
  const { agreementId } = req.params;
  try {
    await prisma.incomeServiceAgreement.delete({
      where: { id: agreementId }
    });
    res.json({ success: true, message: "Agreement deleted" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateClientAgreement = async (req, res) => {
  const { agreementId } = req.params;
  const {
    base,
    description,
    subServiceName,
    serviceStatus,
    serviceName,
    contractFeatures,
    portfolioId,
    discount,
    createdAt,
  } = req.body;

  try {
    const agreement = await prisma.$transaction(async (tx) => {
      const existing = await tx.incomeServiceAgreement.findUnique({
        where: { id: agreementId },
      });

      if (!existing) {
        throw new Error("Agreement not found");
      }

      let serviceId = existing.serviceId;
      let subServiceId = existing.subServiceId;
      const clientId = existing.clientId;

      if (serviceName) {
        const serviceWhere = { serviceName };
        if (portfolioId) {
          serviceWhere.portfolioId = portfolioId;
        }

        let service = await tx.service.findFirst({ where: serviceWhere });
        if (!service) {
          const newServiceId = await generateCustomId({
            entityTybe: "services",
            prisma: tx,
          });
          service = await tx.service.create({
            data: {
              id: newServiceId.data || newServiceId,
              serviceName,
              portfolioId: portfolioId || null,
            },
          });
        }

        serviceId = service.id;

        const linkedService = await tx.clientService.findUnique({
          where: {
            serviceId_clientId: {
              serviceId: service.id,
              clientId,
            },
          },
        });

        if (!linkedService) {
          await tx.clientService.create({
            data: { clientId, serviceId: service.id },
          });
        }
      }

      if (subServiceName) {
        let subService = await tx.subService.findFirst({
          where: { name: subServiceName, categoryId: serviceId },
        });

        if (!subService) {
          const newSubServiceId = await generateCustomId({
            entityTybe: "subservices",
            prisma: tx,
          });
          subService = await tx.subService.create({
            data: {
              id: newSubServiceId.data || newSubServiceId,
              name: subServiceName,
              categoryId: serviceId,
            },
          });
        }

        subServiceId = subService.id;

        const linkedSubService = await tx.clientSubService.findUnique({
          where: {
            subServiceId_clientId: {
              subServiceId: subService.id,
              clientId,
            },
          },
        });

        if (!linkedSubService) {
          await tx.clientSubService.create({
            data: { clientId, subServiceId: subService.id, count: 1 },
          });
        }
      }

      return tx.incomeServiceAgreement.update({
        where: { id: agreementId },
        data: {
          serviceId,
          subServiceId,
          ...(base !== undefined ? { base: Number(base) } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(contractFeatures !== undefined ? { contractFeatures } : {}),
          ...(discount !== undefined ? { discount: Number(discount) } : {}),
          ...(serviceStatus !== undefined
            ? {
                serviceStatus:
                  serviceStatus === "completed" ? "completed" : "pending",
              }
            : {}),
          ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
        },
      });
    }, { timeout: 10000 });

    res.json({ success: true, data: agreement });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteClient = async (req, res) => {
  const { id } = req.params;
  try {
    const scope = getScope(req);
    const existing = await prisma.client.findFirst({
      where: mergeWhere({ id }, clientBranchWhere(scope)),
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Client not found" });
    }

    await prisma.client.delete({ where: { id } });
    res.json({ success: true, message: "Client deleted" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getClientSourcesData = async (req, res) => {
  try {
    const scope = getScope(req);
    const clients = await prisma.client.findMany({
      where: clientBranchWhere(scope),
      select: { source: true }
    });

    const sources = ["Social Media", "Referral", "Website", "Direct", "Other"];
    const total = clients.length;
    const data = sources.map(source => {
      const count = clients.filter(c => c.source === source).length;
      return {
        source,
        count,
        percentage: total > 0 ? ((count / total) * 100).toFixed(1) : 0
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getClientMetrics = async (req, res) => {
  try {
    const scope = getScope(req);
    const where = clientBranchWhere(scope);

    const [
      totalClients,
      activeClients,
      oneTimeClients,
      managedOnDemand,
      managedRecurring,
      activeProjects,
      contentInProgress,
      pendingAgreements,
    ] = await Promise.all([
      prisma.client.count({ where }),
      prisma.client.count({ where: { ...where, isActive: true } }),
      prisma.client.count({ where: { ...where, clientType: "ONE_TIME" } }),
      prisma.client.count({ where: { ...where, clientType: "MANAGED_ON_DEMAND" } }),
      prisma.client.count({ where: { ...where, clientType: "MANAGED_RECURRING" } }),
      prisma.project.count({
        where: {
          status: { in: ["LEAD", "PENDING_PAYMENT", "ACTIVE", "REVIEW"] },
          client: where,
        },
      }),
      prisma.contentRequest.count({
        where: {
          status: {
            notIn: ["COMPLETED", "PUBLISHED"],
          },
          client: where,
        },
      }),
      prisma.incomeServiceAgreement.count({
        where: {
          serviceStatus: "pending",
          client: where,
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalClients,
        activeClients,
        oneTimeClients,
        managedOnDemand,
        managedRecurring,
        activeProjects,
        contentInProgress,
        pendingAgreements,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
