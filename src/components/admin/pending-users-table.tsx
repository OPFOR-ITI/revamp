"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Loader2,
  ShieldCheck,
  UserRoundCheck,
  UserRoundCog,
  UserRoundX,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  switch (status) {
    case "approved":
      return (
        <Badge className="bg-emerald-800 text-white hover:bg-emerald-800">
          Approved
        </Badge>
      );
    case "rejected":
      return <Badge variant="destructive">Rejected</Badge>;
    case "pending":
    default:
      return <Badge variant="outline">Pending</Badge>;
  }
}

function UserRoleBadge({ role }: { role: UserRole }) {
  return (
    <Badge variant="outline" className="bg-white/70">
      {getUserRoleLabel(role)}
    </Badge>
  );
}

function UserRolesList({ roles }: { roles: UserRole[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {roles.map((role) => (
        <UserRoleBadge key={role} role={role} />
      ))}
    </div>
  );
}

function AccessSummaryCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <Card className="border-emerald-950/10 bg-white/80 shadow-lg shadow-emerald-950/5">
      <CardHeader className="flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardDescription>{title}</CardDescription>
          <CardTitle className="mt-2 text-3xl">{value}</CardTitle>
        </div>
        <div className="rounded-2xl bg-emerald-950/[0.06] p-3 text-emerald-900">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="pt-0 text-sm text-zinc-600">
        {description}
      </CardContent>
    </Card>
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>User access</DialogTitle>
          <DialogDescription>
            Review approval state and assign one or more roles for this account.
          </DialogDescription>
        </DialogHeader>

        {user ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-emerald-950/10 bg-emerald-950/[0.03] p-4">
              <p className="font-medium text-zinc-950">{user.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>Created {formatTimestampLabel(user.createdAt)}</span>
                <span>Updated {formatTimestampLabel(user.updatedAt)}</span>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-3">
                <p className="text-sm font-medium text-zinc-950">Approval status</p>
                <Select
                  value={approvalStatus}
                  onValueChange={(value) =>
                    setApprovalStatus(value as ApprovalStatus)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select approval status" />
                  </SelectTrigger>
                  <SelectContent>
                    {APPROVAL_STATUS_VALUES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {getApprovalStatusLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-zinc-950">Current roles</p>
                <UserRolesList roles={roles} />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-zinc-950">Assigned roles</p>
                <p className="text-sm text-muted-foreground">
                  Combine roles to widen access. Admin always keeps full access.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {USER_ROLE_VALUES.map((role) => {
                  const isActive = roles.includes(role);

                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(role)}
                      className={cn(
                        "rounded-2xl border px-4 py-4 text-left transition-colors",
                        isActive
                          ? "border-emerald-900 bg-emerald-950 text-white"
                          : "border-border bg-background hover:border-emerald-700/30",
                      )}
                    >
                      <p className="font-medium">{getUserRoleLabel(role)}</p>
                      <p
                        className={cn(
                          "mt-2 text-sm",
                          isActive ? "text-emerald-50/80" : "text-muted-foreground",
                        )}
                      >
                        {role === "operator"
                          ? "Manage parade-state records and view the duty calendar."
                          : role === "dutyAdmin"
                            ? "Manage duty assignments on the duty calendar."
                            : "Full access to the entire website and user management."}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  void handleSave();
                }}
                disabled={isSaving}
                className="w-full sm:w-auto"
              >
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                Save access
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function UserManagementTable() {
  const users = useQuery(api.admin.listUsers, {}) as ManagedUser[] | undefined;
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);

  const pendingCount = users?.filter((user) => user.approvalStatus === "pending").length;
  const approvedCount = users?.filter((user) => user.approvalStatus === "approved").length;
  const rejectedCount = users?.filter((user) => user.approvalStatus === "rejected").length;

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-3">
          <AccessSummaryCard
            title="Pending queue"
            value={users === undefined ? "--" : String(pendingCount)}
            description="Accounts waiting for their first access decision."
            icon={<UserRoundCog className="size-5" />}
          />
          <AccessSummaryCard
            title="Approved users"
            value={users === undefined ? "--" : String(approvedCount)}
            description="Approved accounts that can sign in and use assigned features."
            icon={<UserRoundCheck className="size-5" />}
          />
          <AccessSummaryCard
            title="Rejected users"
            value={users === undefined ? "--" : String(rejectedCount)}
            description="Accounts currently blocked from the operational workspace."
            icon={<UserRoundX className="size-5" />}
          />
        </div>

        <Card className="border-emerald-950/10 bg-white/80 shadow-lg shadow-emerald-950/5">
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>
              Pending approvals, active accounts, and role assignments live on one
              screen. You cannot edit your own access from here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {users === undefined ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            ) : users.length ? (
              <div className="space-y-3">
                {users.map((user) => (
                  <div
                    key={`${user._id}-mobile`}
                    className="rounded-2xl border border-border bg-background/90 p-4 md:hidden"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-zinc-950">{user.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      <ApprovalStatusBadge status={user.approvalStatus} />
                    </div>
                    <div className="mt-4">
                      <UserRolesList roles={user.roles} />
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">
                        Created {formatTimestampLabel(user.createdAt)}
                      </p>
                      {user.isCurrentUser ? (
                        <Badge variant="outline">Current user</Badge>
                      ) : (
                        <Button size="sm" onClick={() => setSelectedUser(user)}>
                          <ShieldCheck className="size-4" />
                          Manage
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user._id}>
                          <TableCell className="font-medium text-zinc-950">
                            {user.name}
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <ApprovalStatusBadge status={user.approvalStatus} />
                          </TableCell>
                          <TableCell>
                            <div className="min-w-52">
                              <UserRolesList roles={user.roles} />
                            </div>
                          </TableCell>
                          <TableCell>{formatTimestampLabel(user.createdAt)}</TableCell>
                          <TableCell className="text-right">
                            {user.isCurrentUser ? (
                              <Badge variant="outline">Current user</Badge>
                            ) : (
                              <Button size="sm" onClick={() => setSelectedUser(user)}>
                                <ShieldCheck className="size-4" />
                                Manage
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No users found.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
