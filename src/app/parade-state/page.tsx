import { getPrimaryNavGroups } from "@/components/layout/app-navigation";
import { AppSidebarShell } from "@/components/layout/app-sidebar-shell";
import { ParadeReportBuilder } from "@/components/parade-state/parade-report-builder";
import { requireApprovedUser } from "@/lib/auth-guards";

export default async function ParadeReportPage() {
  const user = await requireApprovedUser();

  return (
    <AppSidebarShell
      viewer={{
        name: user.name,
        email: user.email,
        role: user.role,
      }}
      title="Parade Report Dashboard"
      description="Generate a copy-ready company parade-state message from live personnel, status, and duty data."
      navGroups={getPrimaryNavGroups({
        activeItem: "parade-state",
        role: user.role,
      })}
    >
      <ParadeReportBuilder />
    </AppSidebarShell>
  );
}
