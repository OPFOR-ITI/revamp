import type { UserRole } from "@/lib/constants";
import { hasPermission } from "@/lib/access-control";

export type AppNavIcon =
  | "current-state"
  | "record-log"
  | "report"
  | "conducts"
  | "duties"
  | "approvals"
  | "pending";

export type AppNavItemId =
  | "current-state"
  | "record-log"
  | "parade-state"
  | "conducts"
  | "duty-calendar"
  | "user-approvals"
  | "approval-status";

export type AppNavItem = {
  id: AppNavItemId;
  label: string;
  href: string;
  icon: AppNavIcon;
  active?: boolean;
};

export type AppNavGroup = {
  label: string;
  items: AppNavItem[];
};

export function getPrimaryNavGroups({
  activeItem,
  roles = [],
}: {
  activeItem: AppNavItemId;
  roles?: UserRole[];
}): AppNavGroup[] {
  const groups: AppNavGroup[] = [];

  if (hasPermission(roles, "statusRecords.manage")) {
    groups.push({
      label: "Status Tracking",
      items: [
        {
          id: "current-state",
          label: "Current State",
          href: "/",
          icon: "current-state",
          active: activeItem === "current-state",
        },
        {
          id: "record-log",
          label: "Record Log",
          href: "/?view=record-log",
          icon: "record-log",
          active: activeItem === "record-log",
        },
      ],
    });
  }

  if (hasPermission(roles, "paradeReport.view")) {
    groups.push({
      label: "Parade State",
      items: [
        {
          id: "parade-state",
          label: "Parade State",
          href: "/parade-state",
          icon: "report",
          active: activeItem === "parade-state",
        },
      ],
    });
  }

  if (hasPermission(roles, "conducts.view")) {
    groups.push({
      label: "Conducts",
      items: [
        {
          id: "conducts",
          label: "Conduct Tracking",
          href: "/conducts",
          icon: "conducts",
          active: activeItem === "conducts",
        },
      ],
    });
  }

  if (hasPermission(roles, "duties.view")) {
    groups.push({
      label: "Duty",
      items: [
        {
          id: "duty-calendar",
          label: "Duty Calendar",
          href: "/duties",
          icon: "duties",
          active: activeItem === "duty-calendar",
        },
      ],
    });
  }

  if (hasPermission(roles, "userManagement.manage")) {
    groups.push({
      label: "Admin",
      items: [
        {
          id: "user-approvals",
          label: "User management",
          href: "/admin/users",
          icon: "approvals",
          active: activeItem === "user-approvals",
        },
      ],
    });
  }

  return groups;
}
