import { Router } from "express";
import {
  createPortfolio,
  deletePortfolio,
  getAllPortfolios,
  getPortfolioBrandingById,
  getPortfolioById,
  getPortfolioLoginPath,
  getRootLoginPortfolioBranding,
  getPublicPortfolioBySlug,
  updatePortfolio,
  validatePortfolioLogin,
} from "./portfolio.controller.js";

const router = Router();

router.get("/public/slug/:slug", getPublicPortfolioBySlug);
router.get("/public/root-login", getRootLoginPortfolioBranding);
router.post("/validate-login", validatePortfolioLogin);
router.get("/login-path/:portfolioId", getPortfolioLoginPath);
router.get("/branding/:id", getPortfolioBrandingById);
router.get("/", getAllPortfolios);
router.get("/:id", getPortfolioById);
router.post("/", createPortfolio);
router.put("/:id", updatePortfolio);
router.delete("/:id", deletePortfolio);

export default router;
