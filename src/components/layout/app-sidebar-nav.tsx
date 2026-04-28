"use client";

import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  ScrollText,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import type { AppNavGroup, AppNavIcon, AppNavItem } from "@/components/layout/app-navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

function getNavIcon(icon: AppNavIcon) {
  switch (icon) {
    case "current-state":
      return <ShieldCheck className="size-4" />;
    case "record-log":
      return <ClipboardList className="size-4" />;
    case "duties":
      return <CalendarDays className="size-4" />;
    case "report":
      return <ScrollText className="size-4" />;
    case "pending":
      return <UserRound className="size-4" />;
    case "approvals":
    default:
      return <ShieldCheck className="size-4" />;
  }
}

export function AppSidebarNav({
  groups,
  onItemSelect,
}: {
  groups: AppNavGroup[];
  onItemSelect?: (item: AppNavItem) => void;
}) {
  const router = useRouter();

  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={item.active}
                    tooltip={item.label}
                    onClick={() => {
                      onItemSelect?.(item);
                      router.push(item.href);
                    }}
                  >
                    {getNavIcon(item.icon)}
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}
