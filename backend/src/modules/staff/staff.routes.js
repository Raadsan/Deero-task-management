import express from "express";
import staffRoutes from "./staff/staff.routes.js";
import roleRoutes from "./roles/role.routes.js";
import navMenuRoutes from "./menus/navmenu.routes.js";
import authRoutes from "./auth/auth.routes.js";
import notificationRoutes from "./notifications/notification.routes.js";

const router = express.Router();

export {
  staffRoutes,
  roleRoutes,
  navMenuRoutes,
  authRoutes,
  notificationRoutes,
};

export default router;
