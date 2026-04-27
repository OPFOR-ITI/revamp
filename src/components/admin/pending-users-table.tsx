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

export function PendingUsersTable() {
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
    <div className="flex flex-col gap-4">
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
  );
}
