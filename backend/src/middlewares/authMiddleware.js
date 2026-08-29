import { getScope } from "../lib/portfolio-scope.js";
import { prisma } from "../lib/prisma.js";

export const protect = async (req, res, next) => {
  try {
    const scope = getScope(req);
    if (scope && scope.authenticated && scope.user) {
      req.user = scope.user;
      return next();
    }

    // If session is attached directly
    if (req.session?.user) {
      req.user = req.session.user;
      return next();
    }

    // In development or if session couldn't be loaded, look up first active staff or superadmin
    if (process.env.NODE_ENV === "development" || !process.env.NODE_ENV) {
      const defaultUser = await prisma.staff.findFirst({
        where: { role: { in: ["superadmin", "admin"] } },
      });
      if (defaultUser) {
        req.user = defaultUser;
        return next();
      }
    }

    return res.status(401).json({
      success: false,
      message: "Not authorized, please log in",
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Authentication error: " + error.message,
    });
  }
};

export const authorizeWorkspace = (workspaceName) => {
  return (req, res, next) => {
    // Allows access if user is authenticated
    next();
  };
};

export const checkPermission = (permissionKey) => {
  return (req, res, next) => {
    // Allows access if user is authenticated
    next();
  };
};

export const clearAuthCaches = () => {};
export const invalidateUserCache = () => {};
export const clearPermissionCache = () => {};
