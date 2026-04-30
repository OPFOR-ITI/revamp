import { DutyCalendarPage } from "@/components/duties/duty-calendar-page";
import { getPrimaryNavGroups } from "@/components/layout/app-navigation";
import { AppSidebarShell } from "@/components/layout/app-sidebar-shell";
import { hasPermission } from "@/lib/access-control";
import { requireApprovedUserWithPermission } from "@/lib/auth-guards";

export default async function DutiesPage() {
  const user = await requireApprovedUserWithPermission("duties.view");

  return (
    <AppSidebarShell
      viewer={{
        name: user.name,
        email: user.email,
        roles: user.roles,
      }}
      title="Duty Calendar"
      description="Review the duty calendar and, where permitted, manage point-bearing duty assignments."
      navGroups={getPrimaryNavGroups({
        activeItem: "duty-calendar",
        roles: user.roles,
      })}
    >
      <DutyCalendarPage
        canManageAssignments={hasPermission(user.roles, "duties.manage")}
      />
    </AppSidebarShell>
  );
}
