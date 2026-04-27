"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Loader2, ShieldCheck, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTimestampLabel } from "@/lib/date";

export function PendingUsersTable({
  viewer,
}: {
  viewer: {
    name: string;
    email: string;
  };
}) {
  const pendingUsers = useQuery(api.admin.listPendingUsers, {});
  const approveUser = useMutation(api.admin.approveUser);
  const rejectUser = useMutation(api.admin.rejectUser);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<"approve" | "reject" | null>(
    null,
  );

  async function handleAction(
    appUserId: Id<"appUsers">,
    action: "approve" | "reject",
  ) {
    setActiveRowId(appUserId);
    setActiveAction(action);

    try {
      if (action === "approve") {
        await approveUser({ appUserId });
        toast.success("User approved.");
      } else {
        await rejectUser({ appUserId });
        toast.success("User rejected.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update user.");
    } finally {
      setActiveRowId(null);
      setActiveAction(null);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(79,120,67,0.12),_transparent_38%),linear-gradient(180deg,_#f4f0e3_0%,_#ebe5d4_44%,_#e1e7d9_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-[28px] border border-emerald-950/10 bg-[linear-gradient(135deg,_rgba(49,80,42,0.96),_rgba(87,103,53,0.88))] px-6 py-6 text-white shadow-2xl shadow-emerald-950/10">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-100/70">
            Admin Console
          </p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                User approvals
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/85 sm:text-base">
                Approve or reject signed-up operators before they can access the
                parade-state operations screen.
              </p>
            </div>
            <div className="text-sm text-emerald-50/85">
              <p className="font-medium">{viewer.name}</p>
              <p>{viewer.email}</p>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-emerald-950/10 bg-white/80 shadow-lg shadow-emerald-950/5">
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardDescription>Pending queue</CardDescription>
                <CardTitle className="mt-2 text-3xl">
                  {pendingUsers === undefined ? "--" : pendingUsers.length}
                </CardTitle>
              </div>
              <div className="rounded-2xl bg-emerald-950/[0.06] p-3 text-emerald-900">
                <UserRoundPlus className="size-5" />
              </div>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-zinc-600">
              Accounts waiting for their first approval decision.
            </CardContent>
          </Card>

          <Card className="border-emerald-950/10 bg-white/80 shadow-lg shadow-emerald-950/5">
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardDescription>Approval scope</CardDescription>
                <CardTitle className="mt-2 text-3xl">Operators only</CardTitle>
              </div>
              <div className="rounded-2xl bg-emerald-950/[0.06] p-3 text-emerald-900">
                <ShieldCheck className="size-5" />
              </div>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-zinc-600">
              The first admin is still bootstrapped manually in Convex.
            </CardContent>
          </Card>
        </div>

        <Card className="border-emerald-950/10 bg-white/80 shadow-lg shadow-emerald-950/5">
          <CardHeader>
            <CardTitle>Pending users</CardTitle>
            <CardDescription>
              Newly signed-up users appear here until approved or rejected.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingUsers === undefined ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            ) : pendingUsers.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingUsers.map((user) => {
                    const isBusy = activeRowId === user._id;

                    return (
                      <TableRow key={user._id}>
                        <TableCell className="font-medium text-zinc-950">
                          {user.name}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{formatTimestampLabel(user.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleAction(user._id, "approve")}
                              disabled={isBusy}
                            >
                              {isBusy && activeAction === "approve" ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : null}
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAction(user._id, "reject")}
                              disabled={isBusy}
                            >
                              {isBusy && activeAction === "reject" ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : null}
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No pending users right now.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
