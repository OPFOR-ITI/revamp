import { OperationsDashboard } from "@/components/parade-state/operations-dashboard";
import { requireApprovedUser } from "@/lib/auth-guards";

export default async function HomePage() {
  const user = await requireApprovedUser();

  return (
    <OperationsDashboard
      viewer={{
        name: user.name,
        email: user.email,
        role: user.role,
      }}
    />
  );
}
