import { prisma } from "../lib/prisma.js";
import { generateCustomId } from "../lib/id-generator.js";
import {
  clientBranchWhere,
  contractBranchWhere,
  denyIfOutOfScope,
  getScope,
  mergeWhere,
  resolveWritableBranchId,
} from "../lib/branch-scope.js";
import { saveContractFile, deleteContractFileFromDisk } from "../lib/contract-files.js";

const contractInclude = {
  client: { select: { id: true, institution: true, companyName: true, phone: true } },
  project: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  documents: {
    orderBy: { version: "desc" },
    include: { uploadedBy: { select: { id: true, name: true } } },
  },
};

async function findAccessibleContract(scope, id, include = contractInclude) {
  return prisma.contract.findFirst({
    where: mergeWhere({ id }, contractBranchWhere(scope)),
    include,
  });
}

export const getAllContracts = async (req, res) => {
  try {
    const scope = getScope(req);
    const { clientId, status, projectId } = req.query;

    const contracts = await prisma.contract.findMany({
      where: mergeWhere(contractBranchWhere(scope), {
        ...(clientId ? { clientId: String(clientId) } : {}),
        ...(status ? { status: String(status) } : {}),
        ...(projectId ? { projectId: String(projectId) } : {}),
      }),
      include: {
        ...contractInclude,
        documents: {
          orderBy: { version: "desc" },
          take: 1,
          include: { uploadedBy: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: contracts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getContractById = async (req, res) => {
  try {
    const scope = getScope(req);
    const contract = await findAccessibleContract(scope, req.params.id);
    if (!contract) {
      return res.status(404).json({ success: false, error: "Contract not found" });
    }
    res.json({ success: true, data: contract });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createContract = async (req, res) => {
  const data = req.body;
  try {
    const scope = getScope(req);
    const branchId = resolveWritableBranchId(scope, data.branchId);

    const client = await prisma.client.findFirst({
      where: mergeWhere({ id: data.clientId }, clientBranchWhere(scope)),
    });
    if (!client) {
      return res.status(404).json({ success: false, error: "Client not found" });
    }
    if (branchId && denyIfOutOfScope(res, scope, branchId)) return;

    if (data.projectId) {
      const project = await prisma.project.findFirst({
        where: mergeWhere({ id: data.projectId, clientId: client.id }, contractBranchWhere(scope)),
      });
      if (!project) {
        return res.status(400).json({ success: false, error: "Project not found for this client" });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const id = await generateCustomId({ entityTybe: "contracts", prisma: tx });
      const contractNumber =
        data.contractNumber?.trim() ||
        id.replace(/^DCT/, "CTR-");

      const contract = await tx.contract.create({
        data: {
          id,
          contractNumber,
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
          renewalDate: data.renewalDate ? new Date(data.renewalDate) : null,
          totalAmount:
            data.totalAmount !== undefined && data.totalAmount !== null
              ? Number(data.totalAmount)
              : null,
          monthlyAmount:
            data.monthlyAmount !== undefined && data.monthlyAmount !== null
              ? Number(data.monthlyAmount)
              : null,
          billingDay:
            data.billingDay !== undefined && data.billingDay !== null
              ? Number(data.billingDay)
              : 1,
          paymentTerms: data.paymentTerms ?? null,
          status: data.status ?? "ACTIVE",
          notes: data.notes ?? null,
          clientId: client.id,
          projectId: data.projectId ?? null,
          branchId: branchId ?? client.branchId ?? null,
          createdById: scope.user?.id ?? null,
        },
      });

      let document = null;
      const filePayload = data.file ?? data.files?.[0];
      if (filePayload) {
        const saved = await saveContractFile(contract.id, filePayload);
        document = await tx.contractDocument.create({
          data: {
            contractId: contract.id,
            version: 1,
            fileName: saved.name,
            fileUrl: saved.url,
            fileSize: saved.fileSize,
            mimeType: saved.mimeType,
            uploadedById: scope.user?.id ?? null,
          },
        });
      }

      return { contract, document };
    });

    const full = await findAccessibleContract(scope, result.contract.id);
    res.status(201).json({ success: true, data: full });
  } catch (error) {
    console.error("Create contract error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateContract = async (req, res) => {
  const data = req.body;
  try {
    const scope = getScope(req);
    const existing = await findAccessibleContract(scope, req.params.id, { client: true });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Contract not found" });
    }

    const contract = await prisma.contract.update({
      where: { id: existing.id },
      data: {
        ...(data.contractNumber !== undefined
          ? { contractNumber: String(data.contractNumber).trim() }
          : {}),
        ...(data.startDate !== undefined
          ? { startDate: data.startDate ? new Date(data.startDate) : null }
          : {}),
        ...(data.endDate !== undefined
          ? { endDate: data.endDate ? new Date(data.endDate) : null }
          : {}),
        ...(data.renewalDate !== undefined
          ? { renewalDate: data.renewalDate ? new Date(data.renewalDate) : null }
          : {}),
        ...(data.totalAmount !== undefined
          ? {
              totalAmount:
                data.totalAmount !== null ? Number(data.totalAmount) : null,
            }
          : {}),
        ...(data.monthlyAmount !== undefined
          ? {
              monthlyAmount:
                data.monthlyAmount !== null ? Number(data.monthlyAmount) : null,
            }
          : {}),
        ...(data.billingDay !== undefined
          ? {
              billingDay:
                data.billingDay !== null ? Number(data.billingDay) : 1,
            }
          : {}),
        ...(data.paymentTerms !== undefined ? { paymentTerms: data.paymentTerms } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.projectId !== undefined ? { projectId: data.projectId || null } : {}),
      },
    });

    const full = await findAccessibleContract(scope, contract.id);
    res.json({ success: true, data: full });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteContract = async (req, res) => {
  try {
    const scope = getScope(req);
    const existing = await findAccessibleContract(scope, req.params.id, {
      documents: true,
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Contract not found" });
    }

    for (const doc of existing.documents ?? []) {
      await deleteContractFileFromDisk(doc.fileUrl);
    }

    await prisma.contract.delete({ where: { id: existing.id } });
    res.json({ success: true, message: "Contract deleted" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const uploadContractDocument = async (req, res) => {
  try {
    const scope = getScope(req);
    const existing = await findAccessibleContract(scope, req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Contract not found" });
    }

    const filePayload = req.body?.file ?? req.body?.files?.[0];
    if (!filePayload) {
      return res.status(400).json({ success: false, error: "File is required" });
    }

    const saved = await saveContractFile(existing.id, filePayload);

    const lastVersion = await prisma.contractDocument.findFirst({
      where: { contractId: existing.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const version = (lastVersion?.version ?? 0) + 1;

    const document = await prisma.contractDocument.create({
      data: {
        contractId: existing.id,
        version,
        fileName: saved.name,
        fileUrl: saved.url,
        fileSize: saved.fileSize,
        mimeType: saved.mimeType,
        uploadedById: scope.user?.id ?? null,
      },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });

    res.status(201).json({ success: true, data: document });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getContractDocuments = async (req, res) => {
  try {
    const scope = getScope(req);
    const existing = await findAccessibleContract(scope, req.params.id, { documents: false });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Contract not found" });
    }

    const documents = await prisma.contractDocument.findMany({
      where: { contractId: existing.id },
      orderBy: { version: "desc" },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });

    res.json({ success: true, data: documents });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
