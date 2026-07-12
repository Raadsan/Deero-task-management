import { Router } from "express";
import {
  createBranch,
  deleteBranch,
  getAllBranches,
  getBranchBrandingById,
  getBranchById,
  getBranchLoginPath,
  getRootLoginBranchBranding,
  getPublicBranchBySlug,
  updateBranch,
  validateBranchLogin,
} from "../controllers/branchcontroller.js";

const router = Router();

router.get("/public/slug/:slug", getPublicBranchBySlug);
router.get("/public/root-login", getRootLoginBranchBranding);
router.post("/validate-login", validateBranchLogin);
router.get("/login-path/:branchId", getBranchLoginPath);
router.get("/branding/:id", getBranchBrandingById);
router.get("/", getAllBranches);
router.get("/:id", getBranchById);
router.post("/", createBranch);
router.put("/:id", updateBranch);
router.delete("/:id", deleteBranch);

export default router;
