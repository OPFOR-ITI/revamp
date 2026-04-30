import { getPrimaryNavGroups } from "@/components/layout/app-navigation";
import { AppSidebarShell } from "@/components/layout/app-sidebar-shell";
import { ParadeReportBuilder } from "@/components/parade-state/parade-report-builder";
import { requireApprovedUserWithPermission } from "@/lib/auth-guards";

export default async function ParadeReportPage() {
  const user = await requireApprovedUserWithPermission("paradeReport.view");

  return (
    <AppSidebarShell
      viewer={{
        name: user.name,
        email: user.email,
        roles: user.roles,
      }}
      title="Parade Report Dashboard"
      description="Generate a copy-ready company parade-state message from live personnel, status, and duty data."
      navGroups={getPrimaryNavGroups({
        activeItem: "parade-state",
        roles: user.roles,
      })}
    >
      <ParadeReportBuilder />
    </AppSidebarShell>
  );
}
