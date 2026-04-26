import { Router } from "express";
import { getSession } from "../controllers/authcontroller.js";

const router = Router();

router.get("/session", getSession);
router.get("/status", (req, res) => {
    res.json({ message: "Auth route is working" });
});

export default router;

