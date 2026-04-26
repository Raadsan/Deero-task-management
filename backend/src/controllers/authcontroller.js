import { auth } from "../lib/auth.js";

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
