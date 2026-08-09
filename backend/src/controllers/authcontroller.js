import { auth } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";

export const getSession = async (req, res) => {
  try {
    const session = await auth.api.getSession({
        headers: req.headers
    });
    res.json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const checkPasswordResetEmail = async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!email) return res.status(400).json({ success: false, message: "Please enter your email address." });

  try {
    const user = await prisma.staff.findUnique({ where: { email }, select: { id: true } });
    if (!user) return res.status(404).json({ success: false, message: "This email address is not registered." });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false, message: "Unable to verify the email address. Please try again." });
  }
};
