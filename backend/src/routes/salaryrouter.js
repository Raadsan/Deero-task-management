import { Router } from "express";
import { getAllSalaries, createSalaryRecord } from "../controllers/salarycontroller.js";

const router = Router();

router.get("/", getAllSalaries);
router.post("/", createSalaryRecord);

export default router;
