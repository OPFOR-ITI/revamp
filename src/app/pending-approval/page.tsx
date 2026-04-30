import { redirect } from "next/navigation";

import type { AppNavGroup } from "@/components/layout/app-navigation";
import { PendingApprovalPanel } from "@/components/auth/pending-approval-panel";
import { AppSidebarShell } from "@/components/layout/app-sidebar-shell";
import { getDefaultAuthorizedPath } from "@/lib/access-control";
import { getCurrentAppUserOrNull } from "@/lib/auth-guards";

export default async function PendingApprovalPage() {
  const user = await getCurrentAppUserOrNull();

  if (!user) {
    redirect("/sign-in");
  }

  if (user.approvalStatus === "approved") {
    redirect(getDefaultAuthorizedPath(user.roles) ?? "/");
  }

  const navGroups: AppNavGroup[] = [
    {
      label: "Access",
      items: [
        {
          id: "approval-status",
          label: "Approval status",
          href: "/pending-approval",
          icon: "pending",
          active: true,
        },
      ],
    },
  ];

  return (
    <AppSidebarShell
      viewer={{
        name: user.name,
        email: user.email,
      }}
      title={user.approvalStatus === "rejected" ? "Account blocked" : "Waiting for approval"}
      description={
        user.approvalStatus === "rejected"
          ? "This account has been rejected. You can still review the status and sign out."
          : "Your account exists, but an admin has not approved it for operations access yet."
      }
      navGroups={navGroups}
    >
      <PendingApprovalPanel
        name={user.name}
        email={user.email}
        approvalStatus={user.approvalStatus}
      />
    </AppSidebarShell>
  );
}
