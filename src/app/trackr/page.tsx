import { getPrimaryNavGroups } from "@/components/layout/app-navigation";
import { AppSidebarShell } from "@/components/layout/app-sidebar-shell";
import { TrackrActivitiesPage } from "@/components/trackr/trackr-activities-page";
import { requireApprovedUserWithPermission } from "@/lib/auth-guards";

export default async function TrackrPage() {
  const user = await requireApprovedUserWithPermission("conducts.manage");

  return (
    <AppSidebarShell
      viewer={{
        name: user.name,
        email: user.email,
        roles: user.roles,
      }}
      title="Trackr Activities"
      description="Paste a browser cookie and extract normalized activity rows from Trackr before wiring up any downstream automation."
      navGroups={getPrimaryNavGroups({
        activeItem: "trackr-activities",
        roles: user.roles,
      })}
    >
      <TrackrActivitiesPage />
    </AppSidebarShell>
  );
}
