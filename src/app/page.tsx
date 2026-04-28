import { OperationsDashboard } from "@/components/parade-state/operations-dashboard";
import { requireApprovedUser } from "@/lib/auth-guards";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const user = await requireApprovedUser();
  const params = await searchParams;
  const view = Array.isArray(params.view) ? params.view[0] : params.view;
  const initialView = view === "record-log" ? "record-log" : "current-state";

  return (
    <OperationsDashboard
      key={initialView}
      initialView={initialView}
      viewer={{
        name: user.name,
        email: user.email,
        role: user.role,
      }}
    />
  );
}
