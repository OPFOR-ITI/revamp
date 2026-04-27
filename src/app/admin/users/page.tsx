import { PendingUsersTable } from "@/components/admin/pending-users-table";
import { requireAdminUser } from "@/lib/auth-guards";

export default async function AdminUsersPage() {
  const user = await requireAdminUser();

  return (
    <PendingUsersTable
      viewer={{
        name: user.name,
        email: user.email,
      }}
    />
  );
}
