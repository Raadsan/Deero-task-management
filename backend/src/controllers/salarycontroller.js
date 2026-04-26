import { prisma } from "../lib/prisma.js";

export const getAllSalaries = async (req, res) => {
  try {
    const salaries = await prisma.userSalary.findMany({
      include: { recieverUser: true, registeredUser: true, UserSalaryDetails: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: salaries });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createSalaryRecord = async (req, res) => {
  const { id, totalAmount, tax, status, method, notes, taxType, recieverId, registeredBy } = req.body;
  try {
    const salary = await prisma.userSalary.create({
      data: { id, totalAmount, tax, status, method, notes, taxType, recieverId, registeredBy },
    });
    res.status(201).json({ success: true, data: salary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
