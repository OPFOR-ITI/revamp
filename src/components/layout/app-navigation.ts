import type { UserRole } from "@/lib/constants";

export type AppNavIcon =
  | "current-state"
  | "record-log"
  | "report"
  | "duties"
  | "approvals"
  | "pending";

export type AppNavItemId =
  | "current-state"
  | "record-log"
  | "parade-state"
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
  role,
}: {
  activeItem: AppNavItemId;
  role?: UserRole;
}): AppNavGroup[] {
  const groups: AppNavGroup[] = [
    {
      label: "Parade State",
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
        {
          id: "parade-state",
          label: "Parade State",
          href: "/parade-state",
          icon: "report",
          active: activeItem === "parade-state",
        },
      ],
    },
    {
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
    },
  ];

  if (role === "admin") {
    groups.push({
      label: "Admin",
      items: [
        {
          id: "user-approvals",
          label: "User approvals",
          href: "/admin/users",
          icon: "approvals",
          active: activeItem === "user-approvals",
        },
      ],
    });
  }

  return groups;
}
