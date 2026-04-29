import { Router } from "express";
import { getAllSalaries, paySalary, getUserSalaryDetails, getSalaryReport } from "../controllers/salarycontroller.js";

const router = Router();

router.get("/", getAllSalaries);
router.post("/pay", paySalary);
router.get("/user/:userId", getUserSalaryDetails);
router.get("/report", getSalaryReport);

export default router;
