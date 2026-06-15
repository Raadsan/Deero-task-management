import { prisma } from "../lib/prisma.js";
import { generateCustomId } from "../lib/id-generator.js";

const serviceInclude = {
  subService: { orderBy: { name: "asc" } },
  branch: { select: { id: true, name: true, slug: true } },
  _count: { select: { subService: true } },
};

function mapServiceError(error) {
  const raw = error?.message || "";

  if (error.code === "P2002") {
    return "A service or sub-service with this name already exists for this branch.";
  }
  if (error.code === "P2003") {
    return "This service or sub-service is linked to clients and cannot be removed.";
  }
  if (error.code === "P2025") {
    return "Service not found.";
  }
  if (
    raw.includes("Transaction already closed") ||
    raw.includes("interactive transaction timeout") ||
    raw.includes("timeout for this transaction")
  ) {
    return "Saving the service took too long. Please try again.";
  }
  if (raw.includes("Invalid `prisma.")) {
    return "Could not save the service. Please try again.";
  }

  return raw || "Something went wrong. Please try again.";
}

function parseSubServiceNames(subServices) {
  const names = (Array.isArray(subServices) ? subServices : [])
    .map((item) => (typeof item === "string" ? item : item?.name))
    .map((name) => String(name ?? "").trim())
    .filter(Boolean);

  const seen = new Set();
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) {
      throw new Error("Each sub-service name must be unique within this service.");
    }
    seen.add(key);
  }

  return names;
}

function parseSubServiceUpdates(subServices) {
  const incoming = (Array.isArray(subServices) ? subServices : [])
    .map((item) => ({
      id: item?.id ? String(item.id) : undefined,
      name: String(item?.name ?? "").trim(),
    }))
    .filter((item) => item.name);

  const seen = new Set();
  for (const item of incoming) {
    const key = item.name.toLowerCase();
    if (seen.has(key)) {
      throw new Error("Each sub-service name must be unique within this service.");
    }
    seen.add(key);
  }

  return incoming;
}

const SERVICE_TX_OPTIONS = { timeout: 30000, maxWait: 10000 };

async function loadServiceById(id) {
  return prisma.service.findUnique({
    where: { id },
    include: serviceInclude,
  });
}

export const getAllServices = async (req, res) => {
  try {
    const { branchId } = req.query;
    const services = await prisma.service.findMany({
      where: branchId ? { branchId: String(branchId) } : undefined,
      include: serviceInclude,
      orderBy: [{ branch: { name: "asc" } }, { serviceName: "asc" }],
    });
    res.json({ success: true, data: services });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getServiceById = async (req, res) => {
  const { id } = req.params;
  try {
    const service = await prisma.service.findUnique({
      where: { id },
      include: serviceInclude,
    });
    if (!service) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }
    res.json({ success: true, data: service });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createService = async (req, res) => {
  const { serviceName, description, branchId, subServices = [] } = req.body;
  try {
    const trimmedName = String(serviceName ?? "").trim();
    if (!trimmedName) {
      return res.status(400).json({ success: false, error: "Service name is required" });
    }

    if (!branchId) {
      return res.status(400).json({ success: false, error: "Branch is required" });
    }

    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) {
      return res.status(400).json({ success: false, error: "Branch not found" });
    }

    const existing = await prisma.service.findFirst({
      where: { serviceName: trimmedName, branchId },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: "This service already exists for the selected branch",
      });
    }

    const subNames = parseSubServiceNames(subServices);

    const serviceId = await prisma.$transaction(async (tx) => {
      const id = await generateCustomId({ entityTybe: "services", prisma: tx });
      await tx.service.create({
        data: {
          id,
          serviceName: trimmedName,
          description: description?.trim() || null,
          branchId,
        },
      });

      for (const name of subNames) {
        const subId = await generateCustomId({ entityTybe: "subservices", prisma: tx });
        await tx.subService.create({
          data: { id: subId, name, categoryId: id },
        });
      }

      return id;
    }, SERVICE_TX_OPTIONS);

    const service = await loadServiceById(serviceId);

    res.status(201).json({ success: true, data: service });
  } catch (error) {
    console.error("createService error:", error);
    const message =
      error.message?.includes("must be unique") ||
      error.message?.includes("sub-service")
        ? error.message
        : mapServiceError(error);
    const statusCode =
      error.message?.includes("must be unique") ||
      error.message?.includes("sub-service") ||
      error.code === "P2002"
        ? 400
        : 500;
    res.status(statusCode).json({ success: false, error: message });
  }
};

export const updateService = async (req, res) => {
  const { id } = req.params;
  const { serviceName, description, branchId, subServices = [] } = req.body;
  try {
    const trimmedName = String(serviceName ?? "").trim();
    if (!trimmedName) {
      return res.status(400).json({ success: false, error: "Service name is required" });
    }

    if (!branchId) {
      return res.status(400).json({ success: false, error: "Branch is required" });
    }

    const existingService = await prisma.service.findUnique({ where: { id } });
    if (!existingService) {
      return res.status(404).json({ success: false, error: "Service not found" });
    }

    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) {
      return res.status(400).json({ success: false, error: "Branch not found" });
    }

    const duplicate = await prisma.service.findFirst({
      where: {
        serviceName: trimmedName,
        branchId,
        NOT: { id },
      },
    });
    if (duplicate) {
      return res.status(400).json({
        success: false,
        error: "This service already exists for the selected branch",
      });
    }

    const incoming = parseSubServiceUpdates(subServices);

    await prisma.$transaction(async (tx) => {
      await tx.service.update({
        where: { id },
        data: {
          serviceName: trimmedName,
          description: description?.trim() ?? null,
          branchId,
        },
      });

      const existing = await tx.subService.findMany({ where: { categoryId: id } });
      const incomingIds = new Set(incoming.filter((item) => item.id).map((item) => item.id));

      for (const existingSub of existing) {
        if (!incomingIds.has(existingSub.id)) {
          await tx.subService.delete({ where: { id: existingSub.id } });
        }
      }

      for (const sub of incoming) {
        if (sub.id) {
          await tx.subService.update({
            where: { id: sub.id },
            data: { name: sub.name },
          });
        } else {
          const subId = await generateCustomId({ entityTybe: "subservices", prisma: tx });
          await tx.subService.create({
            data: { id: subId, name: sub.name, categoryId: id },
          });
        }
      }
    }, SERVICE_TX_OPTIONS);

    const service = await loadServiceById(id);

    res.json({ success: true, data: service });
  } catch (error) {
    console.error("updateService error:", error);
    const message =
      error.message?.includes("must be unique") ||
      error.message?.includes("sub-service")
        ? error.message
        : mapServiceError(error);
    const statusCode =
      error.message?.includes("must be unique") ||
      error.message?.includes("sub-service") ||
      error.code === "P2002" ||
      error.code === "P2003"
        ? 400
        : 500;
    res.status(statusCode).json({ success: false, error: message });
  }
};

export const deleteService = async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Service not found" });
    }

    await prisma.service.delete({ where: { id } });
    res.json({ success: true, message: "Service deleted successfully" });
  } catch (error) {
    res.status(400).json({ success: false, error: mapServiceError(error) });
  }
};

export const createSubService = async (req, res) => {
  const { name, categoryId, description } = req.body;
  try {
    const id = await generateCustomId({ entityTybe: "subservices" });
    const subService = await prisma.subService.create({
      data: {
        id,
        name,
        categoryId,
        description: description || null,
      },
      include: {
        service: { select: { id: true, serviceName: true } },
      },
    });
    res.status(201).json({ success: true, data: subService });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateSubService = async (req, res) => {
  const { id } = req.params;
  const { name, categoryId, description } = req.body;
  try {
    const subService = await prisma.subService.update({
      where: { id },
      data: {
        name,
        description: description ?? null,
        ...(categoryId ? { categoryId } : {}),
      },
      include: {
        service: { select: { id: true, serviceName: true } },
      },
    });
    res.json({ success: true, data: subService });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteSubService = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.subService.delete({ where: { id } });
    res.json({ success: true, message: "Sub-service deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getSubServicesByServiceId = async (req, res) => {
  const { id } = req.params;
  try {
    const subServices = await prisma.subService.findMany({
      where: { categoryId: id },
      orderBy: { name: "asc" },
      include: {
        service: { select: { id: true, serviceName: true } },
      },
    });
    res.json({ success: true, data: subServices });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getAllSubServices = async (req, res) => {
  try {
    const subServices = await prisma.subService.findMany({
      orderBy: { name: "asc" },
      include: {
        service: { select: { id: true, serviceName: true } },
      },
    });
    res.json({ success: true, data: subServices });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
