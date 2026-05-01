"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getUserRoleLabel } from "@/lib/access-control";
import {
  APPROVAL_STATUS_VALUES,
  USER_ROLE_VALUES,
  type ApprovalStatus,
  type UserRole,
} from "@/lib/constants";
import { formatTimestampLabel } from "@/lib/date";
import { cn } from "@/lib/utils";

type ManagedUser = {
  _id: Id<"appUsers">;
  name: string;
  email: string;
  roles: UserRole[];
  approvalStatus: ApprovalStatus;
  createdAt: number;
  updatedAt: number;
  approvedAt?: number;
  rejectedAt?: number;
  isCurrentUser: boolean;
};

const statusOrder: Record<ApprovalStatus, number> = {
  pending: 0,
  approved: 1,
  rejected: 2,
};

const roleDescriptions: Record<UserRole, string> = {
  operator: "Parade-state operations and duty calendar access.",
  dutyAdmin: "Duty assignment and calendar administration.",
  admin: "Full application and user-management access.",
};

function getApprovalStatusLabel(status: ApprovalStatus) {
  switch (status) {
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "pending":
    default:
      return "Pending";
  }
}

function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  return (
    <Badge
      className={cn(
        "border font-medium shadow-none",
        status === "approved" &&
          "border-emerald-900/15 bg-emerald-900 text-white hover:bg-emerald-900",
        status === "pending" &&
          "border-amber-700/15 bg-amber-100 text-amber-900 hover:bg-amber-100",
        status === "rejected" &&
          "border-red-900/10 bg-red-100 text-red-900 hover:bg-red-100",
      )}
    >
      {getApprovalStatusLabel(status)}
    </Badge>
  );
}

function UserRoleBadge({ role }: { role: UserRole }) {
  return (
    <Badge
      variant="outline"
      className="border-emerald-950/10 bg-white/80 text-zinc-700"
    >
      {getUserRoleLabel(role)}
    </Badge>
  );
}

function UserRolesList({ roles }: { roles: UserRole[] }) {
  if (!roles.length) {
    return <span className="text-sm text-muted-foreground">No roles</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {roles.map((role) => (
        <UserRoleBadge key={role} role={role} />
      ))}
    </div>
  );
}

function SummaryChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: ReactNode;
}) {
  return (
    <div className="min-w-28 rounded-2xl border border-emerald-950/10 bg-white/72 px-3 py-2 shadow-sm shadow-emerald-950/5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          {label}
        </span>
        <span className="text-xs text-zinc-500">{accent}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
        {value}
      </p>
    </div>
  );
}

function UserManagementDialog({
  user,
  open,
  onOpenChange,
}: {
  user: ManagedUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateUserAccess = useMutation(api.admin.updateUserAccess);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>(
    user?.approvalStatus ?? "pending",
  );
  const [roles, setRoles] = useState<UserRole[]>(user?.roles ?? []);
  const [isSaving, setIsSaving] = useState(false);

  function toggleRole(role: UserRole) {
    setRoles((current) => {
      const nextRoles = current.includes(role)
        ? current.filter((value) => value !== role)
        : [...current, role];

      return USER_ROLE_VALUES.filter((value) => nextRoles.includes(value));
    });
  }

  async function handleSave() {
    if (!user) {
      return;
    }

    if (!roles.length) {
      toast.error("Assign at least one role before saving.");
      return;
    }

    setIsSaving(true);

    try {
      await updateUserAccess({
        appUserId: user._id,
        approvalStatus,
        roles,
      });
      toast.success("User access updated.");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update user access.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-1.5rem)] rounded-[1.75rem] border border-emerald-950/10 bg-[linear-gradient(180deg,rgba(250,249,243,0.98),rgba(241,237,225,0.98))] p-0 shadow-2xl shadow-emerald-950/10 sm:max-w-2xl">
        {user ? (
          <>
            <DialogHeader className="border-b border-emerald-950/10 px-5 py-5 sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <DialogTitle className="text-lg text-zinc-950">
                    {user.name}
                  </DialogTitle>
                  <DialogDescription className="mt-1 truncate text-sm text-zinc-600">
                    {user.email}
                  </DialogDescription>
                </div>
                <ApprovalStatusBadge status={approvalStatus} />
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-500">
                <span>Created {formatTimestampLabel(user.createdAt)}</span>
                <span>Updated {formatTimestampLabel(user.updatedAt)}</span>
              </div>
            </DialogHeader>

            <div className="space-y-6 px-5 py-5 sm:px-6">
              <section className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Approval
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">
                    Set whether this account can enter the workspace.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {APPROVAL_STATUS_VALUES.map((status) => {
                    const isActive = approvalStatus === status;

                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setApprovalStatus(status)}
                        className={cn(
                          "rounded-2xl border px-4 py-3 text-left transition-colors",
                          isActive
                            ? "border-emerald-900 bg-emerald-950 text-white shadow-sm"
                            : "border-emerald-950/10 bg-white/85 text-zinc-800 hover:border-emerald-900/30 hover:bg-white",
                        )}
                      >
                        <p className="font-medium">{getApprovalStatusLabel(status)}</p>
                        <p
                          className={cn(
                            "mt-1 text-sm",
                            isActive ? "text-emerald-50/75" : "text-zinc-500",
                          )}
                        >
                          {status === "approved" &&
                            "User can sign in with the selected roles."}
                          {status === "pending" &&
                            "User stays in the review queue until decided."}
                          {status === "rejected" &&
                            "User remains blocked from the workspace."}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Roles
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">
                    At least one role is required for every account.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {USER_ROLE_VALUES.map((role) => {
                    const isActive = roles.includes(role);

                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleRole(role)}
                        className={cn(
                          "rounded-2xl border px-4 py-3 text-left transition-colors",
                          isActive
                            ? "border-emerald-900 bg-white text-zinc-950 shadow-sm"
                            : "border-emerald-950/10 bg-transparent text-zinc-700 hover:border-emerald-900/30 hover:bg-white/70",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-medium">{getUserRoleLabel(role)}</p>
                          {isActive ? (
                            <span className="mt-0.5 size-2.5 rounded-full bg-emerald-700" />
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm text-zinc-500">
                          {roleDescriptions[role]}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            <DialogFooter className="gap-2 border-emerald-950/10 bg-white/55 px-5 py-4 sm:px-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
                className="w-full border-emerald-950/10 bg-white/75 sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  void handleSave();
                }}
                disabled={isSaving}
                className="w-full bg-emerald-950 text-white hover:bg-emerald-900 sm:w-auto"
              >
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                Save
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function UserManagementTable() {
  const users = useQuery(api.admin.listUsers, {}) as ManagedUser[] | undefined;
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);

  const sortedUsers = users
    ? [...users].sort(
        (left, right) =>
          statusOrder[left.approvalStatus] - statusOrder[right.approvalStatus] ||
          right.updatedAt - left.updatedAt,
      )
    : undefined;

  const pendingCount = sortedUsers?.filter(
    (user) => user.approvalStatus === "pending",
  ).length;
  const approvedCount = sortedUsers?.filter(
    (user) => user.approvalStatus === "approved",
  ).length;
  const rejectedCount = sortedUsers?.filter(
    (user) => user.approvalStatus === "rejected",
  ).length;

  return (
    <>
      <section className="overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-[linear-gradient(180deg,rgba(250,248,241,0.98),rgba(236,231,217,0.98))] shadow-[0_24px_70px_-42px_rgba(38,61,30,0.45)]">
        <div className="border-b border-emerald-950/10 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-zinc-600">
              Pending accounts are surfaced first for faster review.
            </p>
            <div className="grid grid-cols-3 gap-2 sm:min-w-[21rem]">
              <SummaryChip
                label="Pending"
                value={sortedUsers === undefined ? "--" : String(pendingCount)}
                accent="Review"
              />
              <SummaryChip
                label="Approved"
                value={sortedUsers === undefined ? "--" : String(approvedCount)}
                accent="Active"
              />
              <SummaryChip
                label="Rejected"
                value={sortedUsers === undefined ? "--" : String(rejectedCount)}
                accent="Blocked"
              />
            </div>
          </div>
        </div>

        <div className="px-4 py-4 sm:px-6 sm:py-5">
          {sortedUsers === undefined ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          ) : sortedUsers.length ? (
            <>
              <div className="space-y-3 md:hidden">
                {sortedUsers.map((user) => (
                  <div
                    key={`${user._id}-mobile`}
                    className={cn(
                      "rounded-[1.6rem] border bg-white/82 p-4 shadow-sm shadow-emerald-950/5",
                      user.approvalStatus === "pending"
                        ? "border-amber-300/80"
                        : "border-emerald-950/10",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-medium text-zinc-950">
                          {user.name}
                        </p>
                        <p className="mt-1 truncate text-sm text-zinc-600">
                          {user.email}
                        </p>
                      </div>
                      <ApprovalStatusBadge status={user.approvalStatus} />
                    </div>
                    <div className="mt-4">
                      <UserRolesList roles={user.roles} />
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-sm text-zinc-500">
                        Updated {formatTimestampLabel(user.updatedAt)}
                      </p>
                      {user.isCurrentUser ? (
                        <Badge variant="outline" className="bg-white/80">
                          Current user
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          className="bg-emerald-950 text-white hover:bg-emerald-900"
                          onClick={() => setSelectedUser(user)}
                        >
                          <ShieldCheck className="size-4" />
                          Edit
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-hidden rounded-[1.6rem] border border-emerald-950/10 bg-white/78 md:block">
                <Table>
                  <TableHeader className="bg-emerald-950/[0.035]">
                    <TableRow className="border-emerald-950/10 hover:bg-transparent">
                      <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        User
                      </TableHead>
                      <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        Status
                      </TableHead>
                      <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        Roles
                      </TableHead>
                      <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        Updated
                      </TableHead>
                      <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedUsers.map((user) => (
                      <TableRow
                        key={user._id}
                        className={cn(
                          "border-emerald-950/10 bg-transparent hover:bg-emerald-950/[0.03]",
                          user.approvalStatus === "pending" && "bg-amber-50/70",
                        )}
                      >
                        <TableCell className="px-4 py-4 align-top whitespace-normal">
                          <div>
                            <p className="font-medium text-zinc-950">{user.name}</p>
                            <p className="mt-1 text-sm text-zinc-600">
                              {user.email}
                            </p>
                            <p className="mt-2 text-xs text-zinc-500">
                              Created {formatTimestampLabel(user.createdAt)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-4 align-top">
                          <ApprovalStatusBadge status={user.approvalStatus} />
                        </TableCell>
                        <TableCell className="px-4 py-4 align-top whitespace-normal">
                          <div className="max-w-sm">
                            <UserRolesList roles={user.roles} />
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-4 align-top text-sm text-zinc-600">
                          {formatTimestampLabel(user.updatedAt)}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-right align-top">
                          {user.isCurrentUser ? (
                            <Badge variant="outline" className="bg-white/80">
                              Current user
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              className="bg-emerald-950 text-white hover:bg-emerald-900"
                              onClick={() => setSelectedUser(user)}
                            >
                              <ShieldCheck className="size-4" />
                              Edit
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="rounded-[1.6rem] border border-dashed border-emerald-950/15 bg-white/60 px-6 py-12 text-center text-sm text-zinc-600">
              No users found.
            </div>
          )}
        </div>
      </section>

      <UserManagementDialog
        key={selectedUser?._id ?? "closed"}
        user={selectedUser}
        open={!!selectedUser}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedUser(null);
          }
        }}
      />
    </>
  );
}
