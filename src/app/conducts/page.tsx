import { getPrimaryNavGroups } from "@/components/layout/app-navigation";
import { AppSidebarShell } from "@/components/layout/app-sidebar-shell";
import { ConductsPage } from "@/components/conducts/conducts-page";
import { hasPermission } from "@/lib/access-control";
import { requireApprovedUserWithPermission } from "@/lib/auth-guards";

export default async function ConductsRoutePage() {
  const user = await requireApprovedUserWithPermission("conducts.view");

  return (
    <AppSidebarShell
      viewer={{
        name: user.name,
        email: user.email,
        roles: user.roles,
      }}
      title="Conduct Tracking"
      description="Create conducts, mark who missed them, and copy a WhatsApp-ready conduct state message."
      navGroups={getPrimaryNavGroups({
        activeItem: "conducts",
        roles: user.roles,
      })}
    >
      <ConductsPage
        canManageConducts={hasPermission(user.roles, "conducts.manage")}
        canManageAttendance={hasPermission(
          user.roles,
          "conductAttendance.manage",
        )}
      />
    </AppSidebarShell>
  );
}
