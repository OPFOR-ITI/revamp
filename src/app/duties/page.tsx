import { DutyCalendarPage } from "@/components/duties/duty-calendar-page";
import { AppSidebarShell } from "@/components/layout/app-sidebar-shell";
import { requireApprovedUser } from "@/lib/auth-guards";

export default async function DutiesPage() {
  const user = await requireApprovedUser();
  const navItems: Array<{
    label: string;
    href: string;
    icon: "operations" | "duties" | "approvals";
    active?: boolean;
  }> = [
    { label: "Operations", href: "/", icon: "operations" as const },
    { label: "Duty Calendar", href: "/duties", icon: "duties" as const, active: true },
  ];

  if (user.role === "admin") {
    navItems.push({
      label: "User approvals",
      href: "/admin/users",
      icon: "approvals",
    });
  }

  return (
    <AppSidebarShell
      viewer={{
        name: user.name,
        email: user.email,
        role: user.role,
      }}
      title="Duty Calendar"
      description="Schedule duties by day, enforce eligibility rules, and manage point-bearing assignments in one calendar view."
      navItems={navItems}
    >
      <DutyCalendarPage />
    </AppSidebarShell>
  );
}
