import { prisma } from "../../../lib/prisma.js";
import mysql from "mysql2/promise";
import { generateCustomId } from "../../../lib/id-generator.js";
import {
  denyIfOutOfScope,
  directBranchWhere,
  getScope,
  mergeWhere,
  resolveWritableBranchId,
  getMainBranch,
} from "../../../lib/portfolio-scope.js";

const serviceInclude = {
  subService: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
  portfolio: { select: { id: true, name: true, slug: true } },
  _count: { select: { subService: true } },
};

function mapServiceError(error) {
  const raw = error?.message || "";

  if (error.code === "P2002") {
    return "A service or sub-service with this name already exists for this portfolio.";
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
  const names = (Array.isArray(subServices) ? subServices : []).map((item, index) => ({
    name: String(typeof item === "string" ? item : item?.name ?? "").trim(),
    price: typeof item === "string" || item?.price === "" || item?.price == null ? null : Number(item.price),
    currency: typeof item === "string" ? "USD" : String(item?.currency || "USD"),
    features: typeof item === "string" || !Array.isArray(item?.features) ? [] : item.features.map(String).filter(Boolean),
    sortOrder: index,
  })).filter((item) => item.name);

  const seen = new Set();
  for (const item of names) {
    const key = item.name.toLowerCase();
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
      price: item?.price === "" || item?.price == null ? null : Number(item.price),
      currency: String(item?.currency || "USD"),
      features: Array.isArray(item?.features) ? item.features.map(String).filter(Boolean) : [],
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
const serviceListCache = new Map();
const SERVICE_LIST_CACHE_MS = 30_000;

function clearServiceListCache() {
  serviceListCache.clear();
}

async function loadServiceById(id) {
  return prisma.service.findUnique({
    where: { id },
    include: serviceInclude,
  });
}

export const getAllServices = async (req, res) => {
  try {
    const scope = getScope(req);
    const cacheKey = scope.seesAllBranches ? "all" : (scope.portfolioId || "public");
    const cached = serviceListCache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < SERVICE_LIST_CACHE_MS) {
      return res.json({ success: true, data: cached.data });
    }
    const services = await prisma.service.findMany({
      where: mergeWhere(directBranchWhere(scope), { source: { not: "LEGACY" } }),
      include: serviceInclude,
      orderBy: [{ portfolio: { name: "asc" } }, { serviceName: "asc" }],
    });
    serviceListCache.set(cacheKey, { createdAt: Date.now(), data: services });
    res.json({ success: true, data: services });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getServiceById = async (req, res) => {
  const { id } = req.params;
  try {
    const scope = getScope(req);
    const service = await prisma.service.findFirst({
      where: mergeWhere({ id }, directBranchWhere(scope)),
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
  const { serviceName, description, portfolioId, serviceType = "ONE_TIME", subServices = [] } = req.body;
  try {
    const scope = getScope(req);
    const resolvedBranchId = (await getMainBranch())?.id || resolveWritableBranchId(scope, portfolioId);
    const trimmedName = String(serviceName ?? "").trim();
    if (!trimmedName) {
      return res.status(400).json({ success: false, error: "Service name is required" });
    }

    if (!resolvedBranchId) {
      return res.status(400).json({ success: false, error: "Portfolio is required" });
    }

    const portfolio = await prisma.portfolio.findUnique({ where: { id: resolvedBranchId } });
    if (!portfolio) {
      return res.status(400).json({ success: false, error: "Portfolio not found" });
    }

    const existing = await prisma.service.findFirst({
      where: { serviceName: trimmedName, portfolioId: resolvedBranchId },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: "This service already exists for the selected portfolio",
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
          serviceType,
          portfolioId: resolvedBranchId,
        },
      });

      for (const item of subNames) {
        const subId = await generateCustomId({ entityTybe: "subservices", prisma: tx });
        await tx.subService.create({
          data: { id: subId, categoryId: id, ...item },
        });
      }

      return id;
    }, SERVICE_TX_OPTIONS);

    const service = await loadServiceById(serviceId);
    clearServiceListCache();

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
  const { serviceName, description, portfolioId, serviceType = "ONE_TIME", subServices = [] } = req.body;
  try {
    const scope = getScope(req);
    const resolvedBranchId = (await getMainBranch())?.id || resolveWritableBranchId(scope, portfolioId);
    const trimmedName = String(serviceName ?? "").trim();
    if (!trimmedName) {
      return res.status(400).json({ success: false, error: "Service name is required" });
    }

    if (!resolvedBranchId) {
      return res.status(400).json({ success: false, error: "Portfolio is required" });
    }

    const existingService = await prisma.service.findFirst({
      where: mergeWhere({ id }, directBranchWhere(scope)),
    });
    if (!existingService) {
      return res.status(404).json({ success: false, error: "Service not found" });
    }
    if (denyIfOutOfScope(res, scope, existingService.portfolioId)) return;

    const portfolio = await prisma.portfolio.findUnique({ where: { id: resolvedBranchId } });
    if (!portfolio) {
      return res.status(400).json({ success: false, error: "Portfolio not found" });
    }

    const duplicate = await prisma.service.findFirst({
      where: {
        serviceName: trimmedName,
        portfolioId: resolvedBranchId,
        NOT: { id },
      },
    });
    if (duplicate) {
      return res.status(400).json({
        success: false,
        error: "This service already exists for the selected portfolio",
      });
    }

    const incoming = parseSubServiceUpdates(subServices);

    await prisma.$transaction(async (tx) => {
      await tx.service.update({
        where: { id },
        data: {
          serviceName: trimmedName,
          description: description?.trim() ?? null,
          serviceType,
          portfolioId: resolvedBranchId,
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
            data: { name: sub.name, price: sub.price, currency: sub.currency, features: sub.features },
          });
        } else {
          const subId = await generateCustomId({ entityTybe: "subservices", prisma: tx });
          await tx.subService.create({
            data: { id: subId, categoryId: id, name: sub.name, price: sub.price, currency: sub.currency, features: sub.features, sortOrder: incoming.indexOf(sub) },
          });
        }
      }
    }, SERVICE_TX_OPTIONS);

    const service = await loadServiceById(id);
    clearServiceListCache();

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
    const scope = getScope(req);
    const existing = await prisma.service.findFirst({
      where: mergeWhere({ id }, directBranchWhere(scope)),
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Service not found" });
    }
    if (denyIfOutOfScope(res, scope, existing.portfolioId)) return;

    await prisma.service.delete({ where: { id } });
    clearServiceListCache();
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

export const syncAdvertServices = async (_req, res) => {
  let connection;
  try {
    if (!process.env.ADVERT_DATABASE_URL) {
      return res.status(500).json({ success: false, error: "ADVERT_DATABASE_URL is not configured" });
    }
    const mainPortfolio = await getMainBranch();
    if (!mainPortfolio) {
      return res.status(400).json({ success: false, error: "Set an active Main portfolio before syncing services" });
    }
    connection = await mysql.createConnection(process.env.ADVERT_DATABASE_URL);
    const [rows] = await connection.query(
      `SELECT s.id serviceId, s.serviceTitle, s.serviceIcon, p.id packageId,
              p.packageTitle, p.price, f.feature
       FROM Service s
       LEFT JOIN ServicePackage p ON p.serviceId = s.id
       LEFT JOIN ServicePackageFeature f ON f.servicePackageId = p.id
       ORDER BY s.id, p.id, f.id`,
    );
    const catalog = new Map();
    for (const row of rows) {
      const serviceKey = String(row.serviceId);
      if (!catalog.has(serviceKey)) catalog.set(serviceKey, { title: row.serviceTitle, icon: row.serviceIcon, packages: new Map() });
      if (row.packageId != null) {
        const packages = catalog.get(serviceKey).packages;
        const packageKey = String(row.packageId);
        if (!packages.has(packageKey)) packages.set(packageKey, { title: row.packageTitle, price: Number(row.price), features: [] });
        if (row.feature) packages.get(packageKey).features.push(row.feature);
      }
    }
    for (const [externalId, source] of catalog) {
      await prisma.$transaction(async (tx) => {
        let service = await tx.service.findUnique({ where: { source_externalId: { source: "ADVERT", externalId } } });
        if (!service) {
          service = await tx.service.findFirst({
            where: { serviceName: source.title, portfolioId: mainPortfolio.id },
          });
        }
        const subscriptionNames = ["digital marketing", "social media management"];
        const serviceType = subscriptionNames.some((name) => source.title.trim().toLowerCase().includes(name)) ? "SUBSCRIPTION" : "ONE_TIME";
        const serviceData = { serviceName: source.title, serviceType, iconUrl: source.icon || null, portfolioId: mainPortfolio.id, lastSyncedAt: new Date() };
        if (service) service = await tx.service.update({
          where: { id: service.id },
          data: { ...serviceData, source: "ADVERT", externalId },
        });
        else service = await tx.service.create({ data: { id: await generateCustomId({ entityTybe: "services", prisma: tx }), source: "ADVERT", externalId, ...serviceData } });
        let sortOrder = 0;
        for (const [packageExternalId, pkg] of source.packages) {
          const packageData = { name: pkg.title, price: pkg.price, currency: "USD", features: pkg.features, sortOrder: sortOrder++ };
          const existingPackage = await tx.subService.findFirst({
            where: {
              categoryId: service.id,
              OR: [{ externalId: packageExternalId }, { name: pkg.title }],
            },
          });
          if (existingPackage) {
            await tx.subService.update({
              where: { id: existingPackage.id },
              data: { ...packageData, externalId: packageExternalId },
            });
          } else {
            await tx.subService.create({
              data: { id: await generateCustomId({ entityTybe: "subservices", prisma: tx }), categoryId: service.id, externalId: packageExternalId, ...packageData },
            });
          }
        }
      }, SERVICE_TX_OPTIONS);
    }
    res.json({ success: true, data: { synced: catalog.size, portfolio: mainPortfolio.name } });
    clearServiceListCache();
  } catch (error) {
    console.error("syncAdvertServices error:", error);
    res.status(500).json({ success: false, error: mapServiceError(error) });
  } finally {
    await connection?.end();
  }
};
