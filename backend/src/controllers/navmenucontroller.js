import { prisma } from "../lib/prisma.js";
import { logAction } from "./trackingcontroller.js";

const roleMenusCache = new Map();
const permissionMatrixCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
let defaultMenusSeedPromise = null;

function getCached(roleId) {
  const entry = roleMenusCache.get(roleId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    roleMenusCache.delete(roleId);
    return null;
  }
  return entry.data;
}

function getCachedMatrix(roleId) {
  const entry = permissionMatrixCache.get(roleId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    permissionMatrixCache.delete(roleId);
    return null;
  }
  return entry.data;
}

function setCachedMatrix(roleId, data) {
  permissionMatrixCache.set(roleId, { data, timestamp: Date.now() });
}

export function clearRoleMenusCache(roleId) {
  if (roleId) {
    roleMenusCache.delete(roleId);
    permissionMatrixCache.delete(roleId);
  } else {
    roleMenusCache.clear();
    permissionMatrixCache.clear();
  }
}

async function fetchMenusForRole(roleId) {
  const cached = getCached(roleId);
  if (cached) return cached;

  const permissions = await prisma.roleMenuAccess.findMany({
    where: { roleId, canView: true },
    include: {
      menu: {
        include: {
          subMenus: {
            where: { isActive: true },
            orderBy: { order: "asc" },
          },
        },
      },
      subAccess: true,
    },
    orderBy: { menu: { order: "asc" } },
  });

  const formatted = permissions
    .filter((p) => p.menu.isActive)
    .map((p) => {
      const allowedSubs = p.menu.subMenus.filter((sm) => {
        const subAccess = p.subAccess.find((rsa) => rsa.subMenuId === sm.id);
        return subAccess?.canView;
      });

      return {
        id: p.menu.id,
        title: p.menu.title,
        url: p.menu.url,
        icon: p.menu.icon,
        order: p.menu.order,
        permissions: {
          canView: p.canView,
          canAdd: p.canAdd,
          canEdit: p.canEdit,
          canDelete: p.canDelete,
        },
        items: allowedSubs.map((sm) => {
          const subAccess = p.subAccess.find((rsa) => rsa.subMenuId === sm.id);
          return {
            id: sm.id,
            title: sm.title,
            url: sm.url,
            order: sm.order,
            permissions: {
              canView: subAccess?.canView || false,
              canAdd: subAccess?.canAdd || false,
              canEdit: subAccess?.canEdit || false,
              canDelete: subAccess?.canDelete || false,
            },
          };
        }),
      };
    });

  roleMenusCache.set(roleId, { data: formatted, timestamp: Date.now() });
  return formatted;
}

export const getMenusByRole = async (req, res) => {
  const { roleId } = req.params;
  try {
    if (!roleId) {
      return res.status(400).json({ success: false, error: "Role ID is required" });
    }
    const data = await fetchMenusForRole(roleId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getRolePermissionMatrix = async (req, res) => {
  const { roleId } = req.params;
  try {
    if (!roleId) {
      return res.status(400).json({ success: false, error: "Role ID is required" });
    }

    const cachedMatrix = getCachedMatrix(roleId);
    if (cachedMatrix) {
      return res.json({ success: true, data: cachedMatrix });
    }

    const [menus, accessList] = await Promise.all([
      prisma.navMenu.findMany({
        where: { isActive: true },
        include: {
          subMenus: {
            where: { isActive: true },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { order: "asc" },
      }),
      prisma.roleMenuAccess.findMany({
        where: { roleId },
        include: { subAccess: true },
      }),
    ]);

    const data = menus.map((menu) => {
      const access = accessList.find((item) => item.menuId === menu.id);
      return {
        id: menu.id,
        title: menu.title,
        url: menu.url,
        icon: menu.icon,
        order: menu.order,
        isActive: menu.isActive,
        permissions: {
          canView: access?.canView ?? false,
          canAdd: access?.canAdd ?? false,
          canEdit: access?.canEdit ?? false,
          canDelete: access?.canDelete ?? false,
        },
        items: menu.subMenus.map((sm) => {
          const subAccess = access?.subAccess?.find((item) => item.subMenuId === sm.id);
          return {
            id: sm.id,
            title: sm.title,
            url: sm.url,
            order: sm.order,
            isActive: sm.isActive,
            permissions: {
              canView: subAccess?.canView ?? false,
              canAdd: subAccess?.canAdd ?? false,
              canEdit: subAccess?.canEdit ?? false,
              canDelete: subAccess?.canDelete ?? false,
            },
          };
        }),
        subMenus: menu.subMenus.map((sm) => {
          const subAccess = access?.subAccess?.find((item) => item.subMenuId === sm.id);
          return {
            id: sm.id,
            title: sm.title,
            url: sm.url,
            order: sm.order,
            isActive: sm.isActive,
            permissions: {
              canView: subAccess?.canView ?? false,
              canAdd: subAccess?.canAdd ?? false,
              canEdit: subAccess?.canEdit ?? false,
              canDelete: subAccess?.canDelete ?? false,
            },
          };
        }),
      };
    });

    setCachedMatrix(roleId, data);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getAllMenus = async (req, res) => {
  try {
    const menus = await prisma.navMenu.findMany({
      include: { subMenus: { orderBy: { order: "asc" } } },
      orderBy: { order: "asc" },
    });
    res.json({
      success: true,
      data: menus.map((m) => ({ ...m, items: m.subMenus })),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createMenu = async (req, res) => {
  const { title, url, icon, order } = req.body;
  try {
    const menu = await prisma.navMenu.create({
      data: { title, url, icon: icon || null, order: Number(order) || 0 },
    });

    const adminRole = await prisma.role.findFirst({
      where: { name: { in: ["superadmin", "admin"] } },
    });
    if (adminRole) {
      await prisma.roleMenuAccess.create({
        data: {
          roleId: adminRole.id,
          menuId: menu.id,
          canView: true,
          canAdd: true,
          canEdit: true,
          canDelete: true,
        },
      });
    }

    clearRoleMenusCache();
    res.status(201).json({ success: true, data: menu });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateMenu = async (req, res) => {
  const { id } = req.params;
  const { title, url, icon, order, isActive } = req.body;
  try {
    const menu = await prisma.navMenu.update({
      where: { id },
      data: {
        title,
        url,
        icon: icon ?? null,
        order: order !== undefined ? Number(order) : undefined,
        isActive,
      },
    });
    clearRoleMenusCache();
    res.json({ success: true, data: menu });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteMenu = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.navMenu.delete({ where: { id } });
    clearRoleMenusCache();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createSubMenu = async (req, res) => {
  const { menuId, title, url, order } = req.body;
  try {
    const submenu = await prisma.navSubMenu.create({
      data: {
        menuId,
        title,
        url,
        order: Number(order) || 0,
      },
    });

    const adminRole = await prisma.role.findFirst({
      where: { name: { in: ["superadmin", "admin"] } },
    });
    if (adminRole) {
      const menuAccess = await prisma.roleMenuAccess.findUnique({
        where: { roleId_menuId: { roleId: adminRole.id, menuId } },
      });
      if (menuAccess) {
        await prisma.roleSubMenuAccess.create({
          data: {
            roleMenuAccessId: menuAccess.id,
            subMenuId: submenu.id,
            canView: true,
            canAdd: true,
            canEdit: true,
            canDelete: true,
          },
        });
      }
    }

    clearRoleMenusCache();
    res.status(201).json({ success: true, data: submenu });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateSubMenu = async (req, res) => {
  const { id } = req.params;
  const { title, url, order, isActive } = req.body;
  try {
    const submenu = await prisma.navSubMenu.update({
      where: { id },
      data: {
        title,
        url,
        order: order !== undefined ? Number(order) : undefined,
        isActive,
      },
    });
    clearRoleMenusCache();
    res.json({ success: true, data: submenu });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteSubMenu = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.navSubMenu.delete({ where: { id } });
    clearRoleMenusCache();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updatePermissions = async (req, res) => {
  const { roleId } = req.params;
  const { permissions } = req.body;

  try {
    const activeMenuPerms = (permissions || []).filter(
      (p) => p.canView || p.canAdd || p.canEdit || p.canDelete,
    );

    const existing = await prisma.roleMenuAccess.findMany({
      where: { roleId },
      select: { id: true },
    });
    const existingIds = existing.map((e) => e.id);

    if (existingIds.length) {
      await prisma.roleSubMenuAccess.deleteMany({
        where: { roleMenuAccessId: { in: existingIds } },
      });
    }
    await prisma.roleMenuAccess.deleteMany({ where: { roleId } });

    for (const menuPerm of activeMenuPerms) {
      const access = await prisma.roleMenuAccess.create({
        data: {
          roleId,
          menuId: menuPerm.menuId,
          canView: !!menuPerm.canView,
          canAdd: !!menuPerm.canAdd,
          canEdit: !!menuPerm.canEdit,
          canDelete: !!menuPerm.canDelete,
        },
      });

      const subRows = (menuPerm.submenus || [])
        .filter(
          (sub) => sub.canView || sub.canAdd || sub.canEdit || sub.canDelete,
        )
        .map((sub) => ({
          roleMenuAccessId: access.id,
          subMenuId: sub.subMenuId,
          canView: !!sub.canView,
          canAdd: !!sub.canAdd,
          canEdit: !!sub.canEdit,
          canDelete: !!sub.canDelete,
        }));

      if (subRows.length) {
        await prisma.roleSubMenuAccess.createMany({ data: subRows });
      }
    }

    clearRoleMenusCache(roleId);
    res.json({ success: true, message: "Permissions updated" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const DEFAULT_MENUS = [
  { title: "Dashboard", url: "/", icon: "LayoutDashboard", order: 1, submenus: [] },
  { title: "Tasks", url: "/tasks", icon: "BriefcaseBusiness", order: 2, submenus: [] },
  { title: "My Tasks", url: "/my-tasks", icon: "ShoppingBag", order: 3, submenus: [] },
  { title: "Clients", url: "/clients", icon: "Handshake", order: 4, submenus: [] },
  { title: "Users", url: "/users", icon: "Users", order: 5, submenus: [] },
  { title: "Services", url: "/services", icon: "Layers", order: 6, submenus: [] },
  { title: "Branches", url: "/branches", icon: "Building2", order: 7, submenus: [] },
  { title: "Departments", url: "/departments", icon: "FolderTree", order: 8, submenus: [] },
  {
    title: "Payment",
    url: "/payments",
    icon: "WalletCards",
    order: 9,
    submenus: [],
  },
  {
    title: "Configuration",
    url: "/config",
    icon: "Settings2",
    order: 10,
    submenus: [
      { title: "Roles", url: "/config/roles", order: 1 },
      { title: "Permissions", url: "/config/permissions", order: 2 },
      { title: "Sidebar Menus", url: "/config/menus", order: 3 },
      { title: "Tracking", url: "/config/tracking", order: 4 },
    ],
  },
];

async function upsertMenuAccess(roleId, menuId, submenuItems = []) {
  let access = await prisma.roleMenuAccess.findUnique({
    where: { roleId_menuId: { roleId, menuId } },
  });

  if (!access) {
    access = await prisma.roleMenuAccess.create({
      data: {
        roleId,
        menuId,
        canView: true,
        canAdd: true,
        canEdit: true,
        canDelete: true,
      },
    });
  }

  for (const sm of submenuItems) {
    const existingSub = await prisma.roleSubMenuAccess.findUnique({
      where: {
        roleMenuAccessId_subMenuId: {
          roleMenuAccessId: access.id,
          subMenuId: sm.id,
        },
      },
    });

    if (!existingSub) {
      await prisma.roleSubMenuAccess.create({
        data: {
          roleMenuAccessId: access.id,
          subMenuId: sm.id,
          canView: true,
          canAdd: true,
          canEdit: true,
          canDelete: true,
        },
      });
    }
  }
}

async function ensureMissingDefaultMenus() {
  const urls = DEFAULT_MENUS.map((menu) => menu.url);
  const existing = await prisma.navMenu.findMany({
    where: { url: { in: urls } },
    select: { url: true },
  });
  const existingUrls = new Set(existing.map((menu) => menu.url));
  const hasMissing = DEFAULT_MENUS.some((menu) => !existingUrls.has(menu.url));
  if (hasMissing) {
    await ensureDefaultMenus();
    return true;
  }
  return false;
}

async function ensureDefaultMenus() {
  if (defaultMenusSeedPromise) {
    return defaultMenusSeedPromise;
  }

  defaultMenusSeedPromise = runEnsureDefaultMenus().finally(() => {
    defaultMenusSeedPromise = null;
  });

  return defaultMenusSeedPromise;
}

async function runEnsureDefaultMenus() {
  let superadmin = await prisma.role.findFirst({ where: { name: "superadmin" } });
  if (!superadmin) {
    superadmin = await prisma.role.create({
      data: { name: "superadmin", description: "Full system access" },
    });
  }

  let admin = await prisma.role.findFirst({ where: { name: "admin" } });
  if (!admin) {
    admin = await prisma.role.create({
      data: { name: "admin", description: "Administrator access" },
    });
  }

  const privilegedRoles = [superadmin, admin].filter(Boolean);
  const createdSubmenus = [];

  for (const menuData of DEFAULT_MENUS) {
    const { submenus, ...fields } = menuData;
    let menu = await prisma.navMenu.findFirst({ where: { url: fields.url } });
    if (menu) {
      menu = await prisma.navMenu.update({
        where: { id: menu.id },
        data: { ...fields, isActive: true },
      });
    } else {
      menu = await prisma.navMenu.create({
        data: { ...fields, isActive: true },
      });
    }

    const submenuRecords = [];
    for (const sm of submenus) {
      let sub = await prisma.navSubMenu.findFirst({
        where: { menuId: menu.id, url: sm.url },
      });
      if (sub) {
        sub = await prisma.navSubMenu.update({
          where: { id: sub.id },
          data: { ...sm, menuId: menu.id, isActive: true },
        });
      } else {
        sub = await prisma.navSubMenu.create({
          data: { ...sm, menuId: menu.id, isActive: true },
        });
      }
      submenuRecords.push(sub);
    }

    for (const role of privilegedRoles) {
      await upsertMenuAccess(role.id, menu.id, submenuRecords);
    }

    createdSubmenus.push({ menu, submenus: submenuRecords });
  }

  await prisma.user.updateMany({
    where: { role: "superadmin", roleId: null },
    data: { roleId: superadmin.id },
  });
  await prisma.user.updateMany({
    where: { role: "admin", roleId: null },
    data: { roleId: admin.id },
  });

  clearRoleMenusCache();
  return createdSubmenus;
}

export async function ensureDefaultMenusOnStartup() {
  const added = await ensureMissingDefaultMenus();
  if (added) {
    console.log("Default sidebar menus synced on startup");
  }
}

export const seedDefaultMenus = async (req, res) => {
  try {
    const createdSubmenus = await ensureDefaultMenus();
    await logAction(null, "SEED", "NavMenu", null, "Default sidebar menus seeded");

    res.json({ success: true, message: "Menus seeded successfully", data: createdSubmenus });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
