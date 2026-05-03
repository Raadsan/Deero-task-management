import { prisma } from "../lib/prisma.js";
import { generateCustomId } from "../lib/id-generator.js";

export const getAllClients = async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      include: {
        clientService: { include: { service: true } },
        clientSubService: { include: { subService: true } },
        serviceAgreements: true
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
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        clientService: { include: { service: true } },
        clientSubService: { include: { subService: true } },
        serviceAgreements: true,
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
  console.log("Creating Client with data:", data);
  try {
    const result = await prisma.$transaction(async (tx) => {
      console.log("Starting Transaction...");
      const id = await generateCustomId({ entityTybe: "clients", prisma: tx });
      console.log("Generated Client ID:", id);
      
      const client = await tx.client.create({
        data: {
          id: id,
          institution: data.institution,
          email: data.email,
          phone: data.phone,
          source: data.source || "Social Media",
        },
      });
      console.log("Client record created:", client.id);

      // Handle Service
      console.log("Checking Service:", data.serviceName);
      let service = await tx.service.findFirst({
        where: { serviceName: { contains: data.serviceName } }
      });
      if (!service) {
        console.log("Service not found, creating new one...");
        const serviceId = await generateCustomId({ entityTybe: "services", prisma: tx });
        service = await tx.service.create({
          data: { id: serviceId.data || serviceId, serviceName: data.serviceName }
        });
      }
      console.log("Service ID:", service.id);

      await tx.clientService.create({
        data: { clientId: client.id, serviceId: service.id }
      });

      // Handle SubService
      console.log("Checking SubService:", data.subServiceName);
      let subService = await tx.subService.findFirst({
        where: { name: data.subServiceName, categoryId: service.id }
      });
      if (!subService) {
        console.log("SubService not found, creating new one...");
        const subServiceId = await generateCustomId({ entityTybe: "subservices", prisma: tx });
        subService = await tx.subService.create({
          data: { id: subServiceId.data || subServiceId, name: data.subServiceName, categoryId: service.id }
        });
      }
      console.log("SubService ID:", subService.id);

      await tx.clientSubService.create({
        data: { clientId: client.id, subServiceId: subService.id, count: 1 }
      });

      // Handle Agreement
      console.log("Creating Service Agreement...");
      await tx.incomeServiceAgreement.create({
        data: {
          clientId: client.id,
          serviceId: service.id,
          subServiceId: subService.id,
          base: Number(data.base),
          description: data.description || "",
          discount: Number(data.discount) || 0,
        }
      });

      console.log("Transaction Success!");
      return client;
    }, {
      timeout: 10000 // 10 seconds
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error("Create Client Error Full Details:", error);
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
  const { base, description, subServiceName } = req.body;
  try {
    const agreement = await prisma.incomeServiceAgreement.update({
      where: { id: agreementId },
      data: {
        base: Number(base),
        description,
        subService: subServiceName ? {
          update: { name: subServiceName }
        } : undefined
      }
    });
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
