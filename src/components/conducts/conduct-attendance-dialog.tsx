"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { api } from "../../../convex/_generated/api";
import type {
  ConductAttendanceEditorState,
  ConductAttendancePersistedReason,
  ConductListItem,
  ConductNominalRollSeed,
} from "@/components/conducts/types";
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
import {
  CONDUCT_ATTENDANCE_REASON_VALUES,
  type ConductAttendanceReason,
} from "@/lib/conduct-attendance";
import { cn } from "@/lib/utils";

const ALL_PLATOONS_VALUE = "__all_platoons__";

type DraftAttendanceEntry = {
  reason: ConductAttendancePersistedReason;
  remarks: string;
};

function StatusBanner({
  status,
  livePersonnelError,
}: {
  status: ConductAttendanceEditorState["snapshotStatus"];
  livePersonnelError: string | null;
}) {
  if (status === "futureLocked") {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Attendance can only be initialized on the actual conduct date.
      </div>
    );
  }

  if (status === "pastLocked") {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        This past conduct date has no saved nominal-roll snapshot, so first-save is blocked.
      </div>
    );
  }

  if (livePersonnelError) {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Live nominal roll is unavailable: {livePersonnelError}
      </div>
    );
  }

  return null;
}

function buildDraftState(
  attendanceState: ConductAttendanceEditorState | undefined,
) {
  if (!attendanceState) {
    return {};
  }

  return Object.fromEntries(
    attendanceState.attendanceEntries.map((entry) => [
      entry.personnelKey,
      {
        reason: entry.reason,
        remarks: entry.remarks ?? "",
      },
    ]),
  ) satisfies Record<string, DraftAttendanceEntry>;
}

function getDraftReason(
  entry: DraftAttendanceEntry | undefined,
): ConductAttendanceReason {
  return entry?.reason ?? "Present";
}

function getPlatoonOptions(personnel: ConductNominalRollSeed[]) {
  return Array.from(new Set(personnel.map((person) => person.platoon)));
}

export function ConductAttendanceDialog({
  open,
  onOpenChange,
  conduct,
  livePersonnelSeed,
  livePersonnelLoading,
  livePersonnelError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conduct: ConductListItem | null;
  livePersonnelSeed: ConductNominalRollSeed[];
  livePersonnelLoading: boolean;
  livePersonnelError: string | null;
}) {
  const saveConductAttendance = useMutation(api.conducts.saveConductAttendance);
  const autoMarkConductAttendanceFromParadeState = useMutation(
    api.conducts.autoMarkConductAttendanceFromParadeState,
  );
  const attendanceState = useQuery(
    api.conducts.getConductAttendanceEditorState,
    open && conduct ? { conductId: conduct._id } : "skip",
  ) as ConductAttendanceEditorState | undefined;
  const [draftByKey, setDraftByKey] = useState<Record<string, DraftAttendanceEntry>>(
    {},
  );
  const [searchValue, setSearchValue] = useState("");
  const [platoonFilter, setPlatoonFilter] = useState(ALL_PLATOONS_VALUE);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoMarking, setIsAutoMarking] = useState(false);
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) {
      setDraftByKey({});
      setSearchValue("");
      setPlatoonFilter(ALL_PLATOONS_VALUE);
      setHasAttemptedSave(false);
      return;
    }

    setDraftByKey(buildDraftState(attendanceState));
  }, [attendanceState, open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const basePersonnel =
    attendanceState && attendanceState.snapshotRows.length > 0
      ? attendanceState.snapshotRows.map((row) => ({
          personnelKey: row.personnelKey,
          rank: row.rank,
          name: row.name,
          platoon: row.platoon,
        }))
      : attendanceState?.snapshotStatus === "canInitializeToday"
        ? livePersonnelSeed
        : [];
  const filteredPersonnel = basePersonnel.filter((person) => {
    if (
      platoonFilter !== ALL_PLATOONS_VALUE &&
      person.platoon !== platoonFilter
    ) {
      return false;
    }

    if (!searchValue.trim()) {
      return true;
    }

    const haystack =
      `${person.rank} ${person.name} ${person.platoon}`.toLowerCase();

    return searchValue
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .every((token) => haystack.includes(token));
  });
  const nonPresentEntries = Object.entries(draftByKey);
  const invalidOtherKeys = nonPresentEntries
    .filter(([, entry]) => entry.reason === "Other" && !entry.remarks.trim())
    .map(([personnelKey]) => personnelKey);
  const reasonBreakdown = CONDUCT_ATTENDANCE_REASON_VALUES.filter(
    (reason) => reason !== "Present",
  )
    .map((reason) => ({
      reason,
      count: Object.values(draftByKey).filter((entry) => entry.reason === reason)
        .length,
    }))
    .filter((item) => item.count > 0);
  const counts = {
    nominalRollCount: basePersonnel.length,
    nonPresentCount: nonPresentEntries.length,
    presentCount: Math.max(basePersonnel.length - nonPresentEntries.length, 0),
  };
  const isLocked =
    attendanceState?.snapshotStatus === "futureLocked" ||
    attendanceState?.snapshotStatus === "pastLocked";
  const canLoadSnapshotToday =
    !livePersonnelLoading &&
    (attendanceState?.snapshotRows.length ?? 0) === 0 &&
    !livePersonnelError;
  const canSave =
    !!conduct &&
    !!attendanceState &&
    !isLocked &&
    !livePersonnelLoading &&
    !isSaving &&
    invalidOtherKeys.length === 0 &&
    (attendanceState.snapshotRows.length > 0 || !livePersonnelError);

  function setReason(personnelKey: string, reason: ConductAttendanceReason) {
    setDraftByKey((current) => {
      if (reason === "Present") {
        const next = { ...current };
        delete next[personnelKey];
        return next;
      }

      const existing = current[personnelKey];

      return {
        ...current,
        [personnelKey]: {
          reason: reason as ConductAttendancePersistedReason,
          remarks: existing?.remarks ?? "",
        },
      };
    });
  }

  function setRemarks(personnelKey: string, remarks: string) {
    setDraftByKey((current) => {
      const existing = current[personnelKey];

      if (!existing) {
        return current;
      }

      return {
        ...current,
        [personnelKey]: {
          ...existing,
          remarks,
        },
      };
    });
  }

  async function handleAutoMark() {
    if (!conduct || !attendanceState) {
      return;
    }

    setIsAutoMarking(true);

    try {
      const response = await autoMarkConductAttendanceFromParadeState({
        conductId: conduct._id,
        nominalRollSeed:
          attendanceState.snapshotRows.length > 0 ? undefined : livePersonnelSeed,
      });

      setDraftByKey(
        Object.fromEntries(
          response.attendanceEntries.map((entry) => [
            entry.personnelKey,
            {
              reason: entry.reason,
              remarks: entry.remarks ?? "",
            },
          ]),
        ),
      );
      setHasAttemptedSave(false);
      toast.success("Attendance draft replaced from parade state.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to auto-mark conduct attendance.",
      );
    } finally {
      setIsAutoMarking(false);
    }
  }

  async function handleSave() {
    if (!conduct || !attendanceState) {
      return;
    }

    setHasAttemptedSave(true);

    if (invalidOtherKeys.length > 0) {
      toast.error('Add remarks for every "Other" attendance row before saving.');
      return;
    }

    setIsSaving(true);

    try {
      await saveConductAttendance({
        conductId: conduct._id,
        attendanceEntries: nonPresentEntries.map(([personnelKey, entry]) => ({
          personnelKey,
          reason: entry.reason,
          remarks: entry.remarks.trim() || undefined,
        })),
        nominalRollSeed:
          attendanceState.snapshotRows.length > 0 ? undefined : livePersonnelSeed,
      });
      toast.success("Conduct attendance saved.");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to save conduct attendance.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-1rem)] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            {conduct ? `${conduct.name} Attendance` : "Conduct Attendance"}
          </DialogTitle>
          <DialogDescription>
            Present stays implicit. Only non-present rows are saved, and `Other`
            requires remarks.
          </DialogDescription>
        </DialogHeader>

        {!attendanceState ? (
          <div className="flex min-h-48 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-[1.1fr_1.1fr_1fr_auto]">
              <div className="rounded-[24px] border border-emerald-950/10 bg-white/80 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-900/55">
                  Posted
                </p>
                <p className="mt-1 text-2xl font-semibold text-zinc-950">
                  {counts.nominalRollCount.toString().padStart(2, "0")}
                </p>
              </div>
              <div className="rounded-[24px] border border-emerald-950/10 bg-emerald-50 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-900/55">
                  Present
                </p>
                <p className="mt-1 text-2xl font-semibold text-emerald-900">
                  {counts.presentCount.toString().padStart(2, "0")}
                </p>
              </div>
              <div className="rounded-[24px] border border-rose-950/10 bg-rose-50 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-rose-900/55">
                  Non-Present
                </p>
                <p className="mt-1 text-2xl font-semibold text-rose-900">
                  {counts.nonPresentCount.toString().padStart(2, "0")}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-full min-h-24 rounded-[24px] border-emerald-950/10 bg-white/80 text-left"
                onClick={() => void handleAutoMark()}
                disabled={
                  isLocked ||
                  isAutoMarking ||
                  (!canLoadSnapshotToday && attendanceState.snapshotRows.length === 0)
                }
              >
                {isAutoMarking ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Auto-mark from parade state
              </Button>
            </div>

            {reasonBreakdown.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {reasonBreakdown.map((item) => (
                  <Badge
                    key={item.reason}
                    variant="outline"
                    className="border-emerald-950/10 bg-white/75 text-zinc-700"
                  >
                    {item.reason}: {item.count}
                  </Badge>
                ))}
              </div>
            ) : null}

            <StatusBanner
              status={attendanceState.snapshotStatus}
              livePersonnelError={
                attendanceState.snapshotRows.length > 0 ? null : livePersonnelError
              }
            />

            {!isLocked ? (
              <>
                <div className="grid gap-3 rounded-[28px] border border-emerald-950/10 bg-[#fbfaf4] p-4 md:grid-cols-[1fr_220px]">
                  <div className="space-y-2">
                    <Label htmlFor="conduct-attendance-search">Search personnel</Label>
                    <Input
                      id="conduct-attendance-search"
                      value={searchValue}
                      onChange={(event) => setSearchValue(event.target.value)}
                      placeholder="Search rank, name, or platoon..."
                      className="rounded-2xl border-emerald-950/10 bg-white/85"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="conduct-attendance-platoon">Platoon filter</Label>
                    <Select
                      value={platoonFilter}
                      onValueChange={(value) =>
                        setPlatoonFilter(value ?? ALL_PLATOONS_VALUE)
                      }
                    >
                      <SelectTrigger
                        id="conduct-attendance-platoon"
                        className="rounded-2xl border-emerald-950/10 bg-white/85"
                      >
                        <SelectValue placeholder="All platoons" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_PLATOONS_VALUE}>
                          All platoons
                        </SelectItem>
                        {getPlatoonOptions(basePersonnel).map((platoon) => (
                          <SelectItem key={platoon} value={platoon}>
                            {platoon}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredPersonnel.length > 0 ? (
                    filteredPersonnel.map((person) => {
                      const draftEntry = draftByKey[person.personnelKey];
                      const reason = getDraftReason(draftEntry);
                      const shouldShowRemarks =
                        reason === "Other" ||
                        reason === "Fall Out" ||
                        !!draftEntry?.remarks.trim();
                      const showOtherError =
                        hasAttemptedSave &&
                        reason === "Other" &&
                        !draftEntry?.remarks.trim();

                      return (
                        <div
                          key={person.personnelKey}
                          className={cn(
                            "rounded-[28px] border border-emerald-950/10 bg-white/90 p-4 shadow-sm shadow-emerald-950/5",
                            reason !== "Present" && "border-rose-950/12 bg-rose-50/35",
                          )}
                        >
                          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-zinc-950">
                                  {person.rank} {person.name}
                                </p>
                                <Badge
                                  variant="outline"
                                  className="border-emerald-950/10 bg-white/75 text-zinc-600"
                                >
                                  {person.platoon}
                                </Badge>
                              </div>
                              <p className="text-xs text-zinc-500">
                                {reason === "Present"
                                  ? "Implicitly present. No row will be saved."
                                  : `Stored as ${reason}.`}
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label>Attendance reason</Label>
                              <Select
                                value={reason}
                                onValueChange={(value) =>
                                  setReason(
                                    person.personnelKey,
                                    value as ConductAttendanceReason,
                                  )
                                }
                              >
                                <SelectTrigger className="rounded-2xl border-emerald-950/10 bg-white/85">
                                  <SelectValue placeholder="Select reason" />
                                </SelectTrigger>
                                <SelectContent>
                                  {CONDUCT_ATTENDANCE_REASON_VALUES.map((option) => (
                                    <SelectItem key={option} value={option}>
                                      {option}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {shouldShowRemarks ? (
                            <div className="mt-4 space-y-2">
                              <Label htmlFor={`remarks-${person.personnelKey}`}>
                                Remarks {reason === "Other" ? "(required)" : "(optional)"}
                              </Label>
                              <Input
                                id={`remarks-${person.personnelKey}`}
                                value={draftEntry?.remarks ?? ""}
                                onChange={(event) =>
                                  setRemarks(person.personnelKey, event.target.value)
                                }
                                placeholder={
                                  reason === "Other"
                                    ? "Explain the non-present status"
                                    : "Add details if needed"
                                }
                                className={cn(
                                  "rounded-2xl border-emerald-950/10 bg-white/85",
                                  showOtherError && "border-red-300 focus-visible:ring-red-200",
                                )}
                              />
                              {showOtherError ? (
                                <p className="text-xs text-red-700">
                                  Other requires remarks before you can save.
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-[28px] border border-dashed border-emerald-950/15 bg-white/75 px-4 py-10 text-center text-sm text-zinc-600">
                      No personnel matched the current filters.
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" onClick={() => onOpenChange(false)} variant="outline">
            Close
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={!canSave}>
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save Attendance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
