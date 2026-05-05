"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { Loader2, ShieldAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import type { ConductAttendanceEditorState } from "@/components/conducts/types";
import type { PersonnelRecord } from "@/lib/personnel";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  TRACKR_REQUIRED_ATTENDANCE_STATUS_NAMES,
  areAttendanceComparableNamesMatching,
  mapConductAttendanceReasonToTrackrStatus,
} from "@/lib/conduct-attendance";
import { formatDateLabel } from "@/lib/date";
import {
  buildTrackrStatusIdByName,
  normalizeTrackrStatusName,
} from "@/lib/trackr-attendance";
import {
  type TrackrActivity,
  trackrStatusSchema,
  type TrackrMixedId,
} from "@/lib/trackr-schema";
import { cn } from "@/lib/utils";

const LEAVE_UNCHANGED_VALUE = "__leave_unchanged__";

type SourceConductDoc = Doc<"conducts">;

type ManualOverrideState = {
  statusName: typeof LEAVE_UNCHANGED_VALUE | (typeof TRACKR_REQUIRED_ATTENDANCE_STATUS_NAMES)[number];
  remarks: string;
};

const routeErrorSchema = z.object({
  error: z
    .object({
      code: z.string().optional(),
      message: z.string().optional(),
    })
    .optional(),
});

const trackrAttendanceReviewResponseSchema = z.object({
  activityId: z.string().uuid(),
  queriedUserCount: z.number().int().nonnegative(),
  statuses: z.array(trackrStatusSchema),
  attendanceRows: z.array(
    z.object({
      attendanceId: z.union([z.string(), z.number()]),
      userId: z.string().optional(),
      name: z.string(),
      currentStatusId: z.union([z.string(), z.number()]).optional(),
      currentStatusName: z.string().optional(),
      currentRemarks: z.string().optional(),
    }),
  ),
});

function getApiErrorMessage(value: unknown) {
  const parsed = routeErrorSchema.safeParse(value);

  if (parsed.success && parsed.data.error?.message) {
    return parsed.data.error.message;
  }

  return "Unexpected Trackr route error.";
}

function getStatusTone(status: string) {
  switch (status) {
    case "Present":
      return "border-emerald-950/10 bg-emerald-50 text-emerald-900";
    case "MC":
      return "border-rose-950/10 bg-rose-50 text-rose-900";
    case "Leave":
      return "border-cyan-950/10 bg-cyan-50 text-cyan-950";
    case "Off":
      return "border-sky-950/10 bg-sky-50 text-sky-950";
    case "Fall Out":
      return "border-amber-950/10 bg-amber-50 text-amber-950";
    case "Other":
      return "border-violet-950/10 bg-violet-50 text-violet-950";
    default:
      return "border-emerald-950/10 bg-white/75 text-zinc-700";
  }
}

function formatConductLabel(conduct: SourceConductDoc) {
  return `${conduct.name} · ${formatDateLabel(conduct.date)} · ${conduct.numberOfPeriods}P`;
}

export function TrackrAttendanceUpdateDialog({
  open,
  onOpenChange,
  activity,
  cookie,
  sourceConducts,
  personnel,
  personnelError,
  isPersonnelLoading,
  canLoadMoreSourceConducts,
  isLoadingMoreSourceConducts,
  onLoadMoreSourceConducts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: TrackrActivity | null;
  cookie: string;
  sourceConducts: SourceConductDoc[];
  personnel: PersonnelRecord[];
  personnelError: string | null;
  isPersonnelLoading: boolean;
  canLoadMoreSourceConducts: boolean;
  isLoadingMoreSourceConducts: boolean;
  onLoadMoreSourceConducts: () => void;
}) {
  const [selectedConductId, setSelectedConductId] = useState<Id<"conducts"> | "">(
    "",
  );
  const [reviewData, setReviewData] = useState<z.infer<
    typeof trackrAttendanceReviewResponseSchema
  > | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [manualOverrides, setManualOverrides] = useState<
    Record<string, ManualOverrideState>
  >({});
  const [isReviewLoading, setIsReviewLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [hasAttemptedUpdate, setHasAttemptedUpdate] = useState(false);
  const selectedConduct =
    sourceConducts.find((conduct) => conduct._id === selectedConductId) ?? null;
  const localAttendanceState = useQuery(
    api.conducts.getConductAttendanceEditorState,
    open && selectedConductId ? { conductId: selectedConductId } : "skip",
  ) as ConductAttendanceEditorState | undefined;

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open || !activity) {
      setSelectedConductId("");
      setReviewData(null);
      setReviewError(null);
      setManualOverrides({});
      setIsReviewLoading(false);
      setHasAttemptedUpdate(false);
      return;
    }

    if (!cookie.trim()) {
      setReviewData(null);
      setReviewError("Enter your Trackr cookie first.");
      return;
    }

    const currentActivity = activity;
    let cancelled = false;

    async function loadReview() {
      setReviewError(null);
      setReviewData(null);
      setManualOverrides({});
      setIsReviewLoading(true);

      try {
        const response = await fetch("/api/trackr/attendance/review", {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cookie,
            activityId: currentActivity.id,
          }),
        });
        const json = (await response.json()) as unknown;

        if (!response.ok) {
          throw new Error(getApiErrorMessage(json));
        }

        const parsed = trackrAttendanceReviewResponseSchema.safeParse(json);

        if (!parsed.success) {
          throw new Error("Trackr attendance review response shape was invalid.");
        }

        if (!cancelled) {
          setReviewData(parsed.data);
        }
      } catch (error) {
        if (!cancelled) {
          setReviewError(
            error instanceof Error
              ? error.message
              : "Unable to load Trackr attendance review.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsReviewLoading(false);
        }
      }
    }

    void loadReview();

    return () => {
      cancelled = true;
    };
  }, [activity, cookie, open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const statuses = reviewData?.statuses ?? [];
  const statusIdByName = buildTrackrStatusIdByName(statuses);
  const statusNameById = new Map(
    statuses.map((status) => [String(status.id), status.name] as const),
  );
  const missingStatuses = TRACKR_REQUIRED_ATTENDANCE_STATUS_NAMES.filter(
    (statusName) =>
      !statusIdByName.has(normalizeTrackrStatusName(statusName)),
  );
  const localSnapshotRows = localAttendanceState?.snapshotRows ?? [];
  const localEntriesByPersonnelKey = new Map(
    (localAttendanceState?.attendanceEntries ?? []).map((entry) => [
      entry.personnelKey,
      entry,
    ] as const),
  );
  const personnelByKey = new Map(
    personnel.map((person) => [person.personnelKey, person] as const),
  );
  const derivedRows = (reviewData?.attendanceRows ?? []).map((row) => {
    const localMatches = localSnapshotRows.filter((localRow) =>
      areAttendanceComparableNamesMatching(localRow.name, row.name) ||
      areAttendanceComparableNamesMatching(
        personnelByKey.get(localRow.personnelKey)?.trackrAlias ?? "",
        row.name,
      ),
    );
    const currentStatusName =
      row.currentStatusName ??
      (row.currentStatusId !== undefined
        ? statusNameById.get(String(row.currentStatusId))
        : undefined);

    if (localMatches.length === 1) {
      const localMatch = localMatches[0];
      const localEntry = localEntriesByPersonnelKey.get(localMatch.personnelKey);
      const targetStatusName = mapConductAttendanceReasonToTrackrStatus(
        localEntry?.reason ?? "Present",
      );

      return {
        kind: "matched" as const,
        row,
        localMatch,
        targetStatusName,
        targetStatusId: statusIdByName.get(
          normalizeTrackrStatusName(targetStatusName),
        ),
        remarks:
          targetStatusName === "Other"
            ? localEntry?.remarks?.trim() || undefined
            : undefined,
        currentStatusName,
      };
    }

    return {
      kind: localMatches.length === 0 ? "unmatched" : "ambiguous",
      row,
      localMatches,
      currentStatusName,
    } as const;
  });

  const matchedRows = derivedRows.filter((row) => row.kind === "matched");
  const exceptionalRows = derivedRows.filter((row) => row.kind !== "matched");
  const invalidManualOtherRows = exceptionalRows.filter((row) => {
    const override = manualOverrides[String(row.row.attendanceId)];

    return override?.statusName === "Other" && !override.remarks.trim();
  });
  const manualOverrideRows = exceptionalRows.filter((row) => {
    const override = manualOverrides[String(row.row.attendanceId)];
    return override && override.statusName !== LEAVE_UNCHANGED_VALUE;
  });
  const unchangedExceptionalCount =
    exceptionalRows.length - manualOverrideRows.length;
  const hasSnapshotForMatching = localSnapshotRows.length > 0;
  const canUpdate =
    !!activity &&
    !!selectedConduct &&
    !!reviewData &&
    !isReviewLoading &&
    !isUpdating &&
    hasSnapshotForMatching &&
    missingStatuses.length === 0 &&
    invalidManualOtherRows.length === 0;

  function setManualOverrideStatus(
    attendanceId: TrackrMixedId,
    value: string | null,
  ) {
    setManualOverrides((current) => ({
      ...current,
      [String(attendanceId)]: {
        statusName: (value ?? LEAVE_UNCHANGED_VALUE) as ManualOverrideState["statusName"],
        remarks: current[String(attendanceId)]?.remarks ?? "",
      },
    }));
  }

  function setManualOverrideRemarks(attendanceId: TrackrMixedId, remarks: string) {
    setManualOverrides((current) => ({
      ...current,
      [String(attendanceId)]: {
        statusName:
          current[String(attendanceId)]?.statusName ?? LEAVE_UNCHANGED_VALUE,
        remarks,
      },
    }));
  }

  async function handleUpdate() {
    if (!canUpdate || !reviewData) {
      return;
    }

    setHasAttemptedUpdate(true);

    if (invalidManualOtherRows.length > 0) {
      toast.error('Add remarks for every manual "Other" override.');
      return;
    }

    const attendances = [
      ...matchedRows.map((row) => ({
        attendanceId: row.row.attendanceId,
        statusId: row.targetStatusId,
        remarks: row.remarks,
      })),
      ...manualOverrideRows.map((row) => {
        const override = manualOverrides[String(row.row.attendanceId)]!;

        if (override.statusName === LEAVE_UNCHANGED_VALUE) {
          throw new Error("Manual override state was left unchanged unexpectedly.");
        }

        return {
          attendanceId: row.row.attendanceId,
          statusId: statusIdByName.get(
            normalizeTrackrStatusName(override.statusName),
          ),
          remarks: override.remarks.trim() || undefined,
        };
      }),
    ];

    if (attendances.some((row) => row.statusId === undefined)) {
      toast.error("One or more Trackr status ids could not be resolved.");
      return;
    }

    if (attendances.length === 0) {
      toast.error("There are no Trackr attendance rows to update.");
      return;
    }

    setIsUpdating(true);

    try {
      const response = await fetch("/api/trackr/attendance/update", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cookie,
          payload: {
            activityId: reviewData.activityId,
            attendances,
          },
        }),
      });
      const json = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(getApiErrorMessage(json));
      }

      toast.success(
        `Trackr updated with ${matchedRows.length} matched rows and ${manualOverrideRows.length} manual override${manualOverrideRows.length === 1 ? "" : "s"}.`,
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update Trackr attendance.",
      );
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-1rem)] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>
            {activity ? `Update Trackr: ${activity.name}` : "Update Trackr"}
          </DialogTitle>
          <DialogDescription>
            Pair this Trackr activity with one local conduct, review the matched
            rows, then apply manual overrides only for unmatched or ambiguous
            Trackr users.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 rounded-[30px] border border-emerald-950/10 bg-[#fbfaf4] p-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-2">
              <Label htmlFor="trackr-review-conduct">Local conduct</Label>
              <Select
                value={selectedConductId ? String(selectedConductId) : undefined}
                onValueChange={(value) => {
                  setSelectedConductId((value as Id<"conducts"> | undefined) ?? "");
                  setHasAttemptedUpdate(false);
                }}
              >
                <SelectTrigger
                  id="trackr-review-conduct"
                  className="rounded-2xl border-emerald-950/10 bg-white/85"
                >
                  <SelectValue placeholder="Select a local conduct" />
                </SelectTrigger>
                <SelectContent>
                  {sourceConducts.map((conduct) => (
                    <SelectItem key={conduct._id} value={conduct._id}>
                      {formatConductLabel(conduct)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                {canLoadMoreSourceConducts ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onLoadMoreSourceConducts}
                    disabled={isLoadingMoreSourceConducts}
                  >
                    {isLoadingMoreSourceConducts ? "Loading..." : "Load more conducts"}
                  </Button>
                ) : null}
                {selectedConduct ? (
                  <p className="text-xs text-zinc-600">
                    Matching base: {selectedConduct.name} on{" "}
                    {formatDateLabel(selectedConduct.date)}.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <div className="rounded-2xl border border-emerald-950/10 bg-white/80 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-900/55">
                  Trackr Rows
                </p>
                <p className="mt-2 text-xl font-semibold text-zinc-950">
                  {reviewData?.attendanceRows.length ?? "--"}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-950/10 bg-white/80 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-900/55">
                  Queried Users
                </p>
                <p className="mt-2 text-xl font-semibold text-zinc-950">
                  {reviewData?.queriedUserCount ?? "--"}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-950/10 bg-white/80 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-900/55">
                  Local Snapshot
                </p>
                <p className="mt-2 text-xl font-semibold text-zinc-950">
                  {selectedConductId
                    ? localAttendanceState?.snapshotRows.length ?? "--"
                    : "--"}
                </p>
              </div>
            </div>
          </div>

          {isReviewLoading ? (
            <div className="flex items-center justify-center gap-2 rounded-[28px] border border-emerald-950/10 bg-white/80 px-4 py-10 text-sm text-zinc-600">
              <Loader2 className="size-4 animate-spin" />
              Preparing Trackr attendance review...
            </div>
          ) : reviewError ? (
            <div className="rounded-[28px] border border-red-300/70 bg-red-50/90 px-4 py-4 text-sm text-red-900">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <p>{reviewError}</p>
              </div>
            </div>
          ) : null}

          {!isReviewLoading && reviewData && missingStatuses.length > 0 ? (
            <div className="rounded-[28px] border border-red-300/70 bg-red-50/90 px-4 py-4 text-sm text-red-900">
              Missing required Trackr statuses: {missingStatuses.join(", ")}.
              Sync is blocked until those status names exist in Trackr.
            </div>
          ) : null}

          {!isReviewLoading && personnelError ? (
            <div className="rounded-[28px] border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              Personnel alias lookup is unavailable: {personnelError}
            </div>
          ) : null}

          {!isReviewLoading && selectedConductId && localAttendanceState && !hasSnapshotForMatching ? (
            <div className="rounded-[28px] border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              The selected local conduct does not have a saved nominal-roll
              snapshot yet, so name matching cannot run.
            </div>
          ) : null}

          {!isReviewLoading && reviewData && selectedConduct && localAttendanceState && hasSnapshotForMatching ? (
            <>
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-950">
                      Matched rows
                    </h3>
                    <p className="text-xs text-zinc-600">
                      These rows matched one local snapshot name and will always be
                      included in the outgoing PATCH.
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-emerald-950/10 bg-white/75 text-zinc-700"
                  >
                    {matchedRows.length} matched
                  </Badge>
                </div>

                <div className="space-y-3">
                  {matchedRows.map((row) => (
                    <div
                      key={String(row.row.attendanceId)}
                      className="rounded-[28px] border border-emerald-950/10 bg-white/90 p-4 shadow-sm shadow-emerald-950/5"
                    >
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-zinc-950">
                              {row.row.name}
                            </p>
                            <Badge
                              variant="outline"
                              className="border-emerald-950/10 bg-white/75 text-zinc-600"
                            >
                              {row.localMatch.rank} {row.localMatch.platoon}
                            </Badge>
                          </div>
                          <p className="text-xs text-zinc-500">
                            Attendance ID {String(row.row.attendanceId)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className="border-emerald-950/10 bg-white/75 text-zinc-700"
                          >
                            Current: {row.currentStatusName ?? "Unknown"}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn("font-medium", getStatusTone(row.targetStatusName))}
                          >
                            Target: {row.targetStatusName}
                          </Badge>
                        </div>
                      </div>

                      {row.remarks ? (
                        <div className="mt-3 rounded-2xl border border-violet-950/10 bg-violet-50/60 px-3 py-2 text-xs text-violet-950">
                          Remarks: {row.remarks}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>

              <Separator />

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-950">
                      Unmatched and ambiguous rows
                    </h3>
                    <p className="text-xs text-zinc-600">
                      Leave these unchanged by default, or set a Trackr-only manual
                      override. Ambiguous names matched more than one local
                      snapshot row.
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-emerald-950/10 bg-white/75 text-zinc-700"
                  >
                    {exceptionalRows.length} needs review
                  </Badge>
                </div>

                {exceptionalRows.length > 0 ? (
                  <div className="space-y-3">
                    {exceptionalRows.map((row) => {
                      const override =
                        manualOverrides[String(row.row.attendanceId)] ?? {
                          statusName: LEAVE_UNCHANGED_VALUE,
                          remarks: "",
                        };
                      const requiresRemarks =
                        override.statusName === "Other";
                      const showManualError =
                        hasAttemptedUpdate &&
                        requiresRemarks &&
                        !override.remarks.trim();

                      return (
                        <div
                          key={String(row.row.attendanceId)}
                          className="rounded-[28px] border border-amber-950/12 bg-amber-50/40 p-4"
                        >
                          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-zinc-950">
                                  {row.row.name}
                                </p>
                                <Badge
                                  variant="outline"
                                  className="border-amber-950/10 bg-white/80 text-amber-950"
                                >
                                  {row.kind === "ambiguous" ? "Ambiguous" : "Unmatched"}
                                </Badge>
                              </div>
                              <p className="text-xs text-zinc-600">
                                {row.kind === "ambiguous"
                                  ? `Matched ${row.localMatches.length} local rows by name.`
                                  : "No local snapshot row matched this Trackr name."}
                              </p>
                              <p className="text-xs text-zinc-500">
                                Current Trackr status: {row.currentStatusName ?? "Unknown"}
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label>Manual override</Label>
                              <Select
                                value={override.statusName}
                                onValueChange={(value) =>
                                  setManualOverrideStatus(row.row.attendanceId, value)
                                }
                              >
                                <SelectTrigger className="rounded-2xl border-emerald-950/10 bg-white/90">
                                  <SelectValue placeholder="Leave unchanged" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={LEAVE_UNCHANGED_VALUE}>
                                    Leave unchanged
                                  </SelectItem>
                                  {TRACKR_REQUIRED_ATTENDANCE_STATUS_NAMES.map((statusName) => (
                                    <SelectItem key={statusName} value={statusName}>
                                      {statusName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {override.statusName !== LEAVE_UNCHANGED_VALUE ? (
                            <div className="mt-4 space-y-2">
                              <Label htmlFor={`override-${row.row.attendanceId}`}>
                                Remarks {requiresRemarks ? "(required for Other)" : "(optional)"}
                              </Label>
                              <Input
                                id={`override-${row.row.attendanceId}`}
                                value={override.remarks}
                                onChange={(event) =>
                                  setManualOverrideRemarks(
                                    row.row.attendanceId,
                                    event.target.value,
                                  )
                                }
                                placeholder={
                                  requiresRemarks
                                    ? "Explain the Trackr-only override"
                                    : "Optional manual remarks"
                                }
                                className={cn(
                                  "rounded-2xl border-emerald-950/10 bg-white/90",
                                  showManualError &&
                                    "border-red-300 focus-visible:ring-red-200",
                                )}
                              />
                              {showManualError ? (
                                <p className="text-xs text-red-700">
                                  Manual `Other` overrides require remarks.
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-[28px] border border-dashed border-emerald-950/15 bg-white/80 px-4 py-10 text-center text-sm text-zinc-600">
                    Every Trackr row matched exactly one local snapshot name.
                  </div>
                )}
              </section>

              <Separator />

              <section className="rounded-[30px] border border-emerald-950/10 bg-[#f6f4ea] p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
                  <Sparkles className="size-4 text-emerald-900" />
                  Confirmation summary
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-emerald-950/10 bg-white/80 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-900/55">
                      Matched updates
                    </p>
                    <p className="mt-2 text-xl font-semibold text-zinc-950">
                      {matchedRows.length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-950/10 bg-white/80 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-900/55">
                      Manual overrides
                    </p>
                    <p className="mt-2 text-xl font-semibold text-zinc-950">
                      {manualOverrideRows.length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-950/10 bg-white/80 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-900/55">
                      Leave unchanged
                    </p>
                    <p className="mt-2 text-xl font-semibold text-zinc-950">
                      {unchangedExceptionalCount}
                    </p>
                  </div>
                </div>
              </section>
            </>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" onClick={() => void handleUpdate()} disabled={!canUpdate}>
            {isUpdating ? <Loader2 className="size-4 animate-spin" /> : null}
            Update Trackr
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
