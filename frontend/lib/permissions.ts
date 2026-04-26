import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";
const statement = {
  ...defaultStatements,
  task: ["create", "edit", "delete", "own:edit"],
  client: ["create", "edit", "delete"],
} as const;

export const accessControl = createAccessControl(statement);

export const userRole = accessControl.newRole({
  task: ["own:edit"],
});

export const adminRole = accessControl.newRole({
  task: ["create", "edit", "delete"],
  client: ["create", "edit", "delete"],
  user: ["ban", "create", "list", "set-password", "set-role", "update"],
});

export const superAdminRole = accessControl.newRole({
  task: ["create", "edit", "delete"],
  client: ["create", "edit", "delete"],
  ...adminAc.statements,
});
