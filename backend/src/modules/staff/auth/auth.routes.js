import { Router } from "express";
import { checkPasswordResetEmail, getSession } from "./auth.controller.js";

const router = Router();

router.get("/session", getSession);
router.post("/password-reset/check-email", checkPasswordResetEmail);
router.get("/status", (req, res) => {
    res.json({ message: "Auth route is working" });
});

export default router;

