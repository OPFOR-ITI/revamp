"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import type { ApprovalStatus } from "@/lib/constants";

export function PendingApprovalPanel({
  name,
  email,
  approvalStatus,
}: {
  name: string;
  email: string;
  approvalStatus: ApprovalStatus;
}) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const isRejected = approvalStatus === "rejected";

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await authClient.signOut();
      router.replace("/sign-in");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <AuthShell
      eyebrow={isRejected ? "Access Rejected" : "Approval Pending"}
      title={isRejected ? "Account blocked" : "Waiting for approval"}
      description={
        isRejected
          ? "An admin has rejected this account. You remain signed in here only to view the status and sign out."
          : "Your account exists, but an admin has not approved it for operations access yet."
      }
      embedded
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-emerald-950/10 bg-emerald-950/[0.03] p-4">
          <p className="text-sm font-medium text-zinc-900">{name}</p>
          <p className="mt-1 text-sm text-zinc-600">{email}</p>
          <p className="mt-3 text-xs uppercase tracking-[0.24em] text-emerald-800/70">
            Status: {approvalStatus}
          </p>
        </div>

        <p className="text-sm leading-6 text-zinc-600">
          {isRejected
            ? "If this was unexpected, an admin will need to change your approval status later. There is no self-service appeal flow in this MVP."
            : "Once approved, refresh or sign in again and you will be redirected to the operations screen automatically."}
        </p>

        <Button
          className="w-full"
          variant="outline"
          onClick={handleSignOut}
          disabled={isSigningOut}
        >
          {isSigningOut ? <Loader2 className="size-4 animate-spin" /> : null}
          Sign out
        </Button>
      </div>
    </AuthShell>
  );
}
