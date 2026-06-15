import { prisma } from "../lib/prisma.js";
import { generateCustomId } from "../lib/id-generator.js";

async function attachClientServiceAgreement(tx, {
  clientId,
  serviceName,
  subServiceName,
  base,
  description,
  discount,
  branchId,
  createdAt,
  serviceStatus,
}) {
  const serviceWhere = { serviceName };
  if (branchId) {
    serviceWhere.branchId = branchId;
  }

  let service = await tx.service.findFirst({ where: serviceWhere });
  if (!service) {
    const serviceId = await generateCustomId({ entityTybe: "services", prisma: tx });
    service = await tx.service.create({
      data: {
        id: serviceId.data || serviceId,
        serviceName,
        branchId: branchId || null,
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

  await tx.incomeServiceAgreement.create({
    data: {
      clientId,
      serviceId: service.id,
      subServiceId: subService.id,
      base: Number(base),
      description: description || "",
      discount: Number(discount) || 0,
      serviceStatus: serviceStatus === "completed" ? "completed" : "pending",
      ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
    },
  });

  return { service, subService };
}

const clientListInclude = {
  clientService: {
    include: {
      service: { include: { branch: { select: { id: true, name: true } } } },
    },
  },
  clientSubService: { include: { subService: true } },
  serviceAgreements: {
    include: {
      service: { include: { branch: { select: { id: true, name: true } } } },
      subService: true,
    },
    orderBy: { createdAt: "desc" },
  },
};

export const getAllClients = async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      include: clientListInclude,
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
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        ...clientListInclude,
        clientTask: { include: { task: true } },
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
    const result = await prisma.$transaction(async (tx) => {
      const id = await generateCustomId({ entityTybe: "clients", prisma: tx });
      const email =
        data.email?.trim() ||
        `client-${String(data.phone).replace(/\D/g, "")}@deero.so`;

      const client = await tx.client.create({
        data: {
          id,
          institution: data.institution,
          email,
          phone: data.phone,
          source: data.source || "",
          ...(data.createdAt ? { createdAt: new Date(data.createdAt) } : {}),
        },
      });

      await attachClientServiceAgreement(tx, {
        clientId: client.id,
        serviceName: data.serviceName,
        subServiceName: data.subServiceName,
        base: data.base,
        description: data.description,
        discount: data.discount,
        branchId: data.branchId,
        createdAt: data.createdAt,
        serviceStatus: data.serviceStatus,
      });

      return client;
    }, {
      timeout: 10000,
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error("Create Client Error:", error);
    res.status(500).json({ success: false, error: error.message || "Internal Server Error" });
  }
};

export const addClientService = async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  try {
    const client = await prisma.client.findUnique({ where: { id } });
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
        branchId: data.branchId,
        createdAt: data.createdAt,
        serviceStatus: data.serviceStatus,
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
  const { institution, email, phone, source, discount, createdAt } = req.body;
  try {
    const client = await prisma.client.update({
      where: { id },
      data: {
        institution,
        email,
        phone,
        source,
        createdAt: createdAt ? new Date(createdAt) : undefined,
      },
    });

    if (discount !== undefined) {
      await prisma.incomeServiceAgreement.updateMany({
        where: { clientId: id },
        data: { discount: Number(discount) }
      });
    }

    res.json({ success: true, data: client });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
    branchId,
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
        if (branchId) {
          serviceWhere.branchId = branchId;
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
              branchId: branchId || null,
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
    await prisma.client.delete({ where: { id } });
    res.json({ success: true, message: "Client deleted" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getClientSourcesData = async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
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
