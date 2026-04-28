import { PendingUsersTable } from "@/components/admin/pending-users-table";
import { getPrimaryNavGroups } from "@/components/layout/app-navigation";
import { AppSidebarShell } from "@/components/layout/app-sidebar-shell";
import { requireAdminUser } from "@/lib/auth-guards";

export default async function AdminUsersPage() {
  const user = await requireAdminUser();

  return (
    <AppSidebarShell
      viewer={{
        name: user.name,
        email: user.email,
        role: user.role,
      }}
      title="User approvals"
      description="Approve or reject signed-up operators before they can access the operations workspace."
      navGroups={getPrimaryNavGroups({
        activeItem: "user-approvals",
        role: user.role,
      })}
    >
      <PendingUsersTable />
    </AppSidebarShell>
  );
}
