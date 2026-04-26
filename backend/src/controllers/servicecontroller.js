import { prisma } from "../lib/prisma.js";

export const getAllServices = async (req, res) => {
  try {
    const services = await prisma.service.findMany({
      include: { subService: true },
    });
    res.json({ success: true, data: services });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createService = async (req, res) => {
  const { id, serviceName } = req.body;
  try {
    const service = await prisma.service.create({
      data: { id, serviceName },
    });
    res.status(201).json({ success: true, data: service });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createSubService = async (req, res) => {
  const { id, name, categoryId } = req.body;
  try {
    const subService = await prisma.subService.create({
      data: { id, name, categoryId },
    });
    res.status(201).json({ success: true, data: subService });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getSubServicesByServiceId = async (req, res) => {
  const { id } = req.params;
  try {
    const subServices = await prisma.subService.findMany({
      where: { categoryId: id }
    });
    res.json({ success: true, data: subServices });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
