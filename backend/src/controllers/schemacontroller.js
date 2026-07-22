import { prisma } from "../lib/prisma.js";
import {
  clientBranchWhere,
  getScope,
  mergeWhere,
  resolveWritableBranchId,
} from "../lib/portfolio-scope.js";

const schemaInclude = {
  client: {
    select: {
      id: true,
      institution: true,
      companyName: true,
      contactPerson: true,
      email: true,
      phone: true,
      clientType: true,
      portfolioId: true,
    },
  },
  portfolio: {
    select: {
      id: true,
      name: true,
    },
  },
};

export const getAllSchemas = async (req, res) => {
  try {
    const scope = getScope(req);
    const { clientId } = req.query;

    const schemas = await prisma.clientSchema.findMany({
      where: mergeWhere(
        scope.allBranches ? {} : { portfolioId: scope.portfolioId },
        clientId ? { clientId: String(clientId) } : {}
      ),
      include: schemaInclude,
      orderBy: { updatedAt: "desc" },
    });

    res.json({ success: true, data: schemas });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getSchemaById = async (req, res) => {
  try {
    const scope = getScope(req);
    const schema = await prisma.clientSchema.findFirst({
      where: mergeWhere(
        { id: req.params.id },
        scope.allBranches ? {} : { portfolioId: scope.portfolioId }
      ),
      include: schemaInclude,
    });

    if (!schema) {
      return res.status(404).json({ success: false, error: "Schema not found" });
    }

    res.json({ success: true, data: schema });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createOrUpdateSchema = async (req, res) => {
  try {
    const scope = getScope(req);
    const {
      clientId,
      saturday,
      sunday,
      monday,
      tuesday,
      wednesday,
      thursday,
      friday,
      notes,
    } = req.body;

    if (!clientId) {
      return res.status(400).json({ success: false, error: "Client ID is required" });
    }

    const client = await prisma.client.findFirst({
      where: mergeWhere({ id: clientId }, clientBranchWhere(scope)),
    });

    if (!client) {
      return res.status(404).json({ success: false, error: "Client not found" });
    }

    const portfolioId = resolveWritableBranchId(scope, client.portfolioId);

    const schema = await prisma.clientSchema.upsert({
      where: { clientId: client.id },
      create: {
        clientId: client.id,
        portfolioId,
        saturday: saturday ?? null,
        sunday: sunday ?? null,
        monday: monday ?? null,
        tuesday: tuesday ?? null,
        wednesday: wednesday ?? null,
        thursday: thursday ?? null,
        friday: friday ?? null,
        notes: notes ?? null,
      },
      update: {
        portfolioId: portfolioId ?? undefined,
        saturday: saturday !== undefined ? saturday : undefined,
        sunday: sunday !== undefined ? sunday : undefined,
        monday: monday !== undefined ? monday : undefined,
        tuesday: tuesday !== undefined ? tuesday : undefined,
        wednesday: wednesday !== undefined ? wednesday : undefined,
        thursday: thursday !== undefined ? thursday : undefined,
        friday: friday !== undefined ? friday : undefined,
        notes: notes !== undefined ? notes : undefined,
      },
      include: schemaInclude,
    });

    res.status(200).json({ success: true, data: schema });
  } catch (error) {
    console.error("Save schema error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteSchema = async (req, res) => {
  try {
    const scope = getScope(req);
    const schema = await prisma.clientSchema.findFirst({
      where: mergeWhere(
        { id: req.params.id },
        scope.allBranches ? {} : { portfolioId: scope.portfolioId }
      ),
    });

    if (!schema) {
      return res.status(404).json({ success: false, error: "Schema not found" });
    }

    await prisma.clientSchema.delete({ where: { id: schema.id } });
    res.json({ success: true, message: "Schema deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
