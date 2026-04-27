import { redirect } from "next/navigation";

import { PendingApprovalPanel } from "@/components/auth/pending-approval-panel";
import { getCurrentAppUserOrNull } from "@/lib/auth-guards";

export default async function PendingApprovalPage() {
  const user = await getCurrentAppUserOrNull();

  if (!user) {
    redirect("/sign-in");
  }

  if (user.approvalStatus === "approved") {
    redirect("/");
  }

  return (
    <PendingApprovalPanel
      name={user.name}
      email={user.email}
      approvalStatus={user.approvalStatus}
    />
  );
}
