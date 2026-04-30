import type { UserRole } from "@/lib/constants";

export const APP_PERMISSION_VALUES = [
  "statusRecords.manage",
  "duties.view",
  "duties.manage",
  "paradeReport.view",
  "userManagement.manage",
] as const;

export type AppPermission = (typeof APP_PERMISSION_VALUES)[number];

const ROLE_ORDER: readonly UserRole[] = ["admin", "operator", "dutyAdmin"];

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  operator: "Operator",
  dutyAdmin: "Duty Admin",
};

const ROLE_PERMISSIONS: Record<UserRole, readonly AppPermission[]> = {
  admin: APP_PERMISSION_VALUES,
  operator: ["statusRecords.manage", "duties.view", "paradeReport.view"],
  dutyAdmin: ["duties.view", "duties.manage"],
};

type UserRoleSource = {
  roles: readonly string[];
};

export function isUserRole(value: string): value is UserRole {
  return (ROLE_ORDER as readonly string[]).includes(value);
}

export function getUserRoleLabel(role: UserRole) {
  return ROLE_LABELS[role];
}

export function resolveUserRoles(user: UserRoleSource): UserRole[] {
  const nextRoles = new Set<UserRole>();

  for (const role of user.roles) {
    if (isUserRole(role)) {
      nextRoles.add(role);
    }
  }

  return ROLE_ORDER.filter((role) => nextRoles.has(role));
}

export function formatUserRolesLabel(roles: readonly UserRole[]) {
  return roles.map(getUserRoleLabel).join(", ");
}

export function hasRole(roles: readonly UserRole[], role: UserRole) {
  return roles.includes(role);
}

export function hasPermission(
  roles: readonly UserRole[],
  permission: AppPermission,
) {
  return roles.some((role) => ROLE_PERMISSIONS[role].includes(permission));
}

export function getDefaultAuthorizedPath(roles: readonly UserRole[]) {
  if (hasPermission(roles, "statusRecords.manage")) {
    return "/";
  }

  if (hasPermission(roles, "duties.view")) {
    return "/duties";
  }

  if (hasPermission(roles, "paradeReport.view")) {
    return "/parade-state";
  }

  if (hasPermission(roles, "userManagement.manage")) {
    return "/admin/users";
  }

  return null;
}
