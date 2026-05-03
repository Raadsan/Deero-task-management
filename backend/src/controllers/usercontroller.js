import { prisma } from "../lib/prisma.js";
import { auth } from "../lib/auth.js";

export const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createUser = async (req, res) => {
  const { name, email, password, role, gender, department, salary } = req.body;
  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    // Use better-auth to create user so password is hashed
    const result = await auth.api.createUser({
      body: {
        name,
        email,
        password,
        role: role || "user",
      },
    });

    // Update additional fields
    const updatedUser = await prisma.user.update({
      where: { id: result.user.id },
      data: {
        gender,
        department,
        salary: salary ? String(salary) : null,
        dynamicRole: req.body.roleId ? { connect: { id: req.body.roleId } } : undefined,
        role: role || "user"
      },
    });

    res.status(201).json({ success: true, data: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, role, gender, department, salary } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        name,
        email,
        role,
        gender,
        department,
        salary: salary ? String(salary) : undefined,
      },
    });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
export const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.user.delete({
      where: { id },
    });
    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
