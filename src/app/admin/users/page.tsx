import { UserManagementTable } from "@/components/admin/pending-users-table";
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
        roles: user.roles,
      }}
      title="Users"
      navGroups={getPrimaryNavGroups({
        activeItem: "user-approvals",
        roles: user.roles,
      })}
    >
      <UserManagementTable />
    </AppSidebarShell>
  );
}
