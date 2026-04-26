import { Router } from "express";
import { generateCustomId } from "../lib/id-generator.js";

const router = Router();

router.get("/generate-id", async (req, res) => {
  const { type } = req.query;
  try {
    const id = await generateCustomId({ entityTybe: type });
    res.json({ success: true, data: id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
