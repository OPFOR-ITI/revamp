"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
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

function getAttendanceStatusTone(reason: ConductAttendanceReason) {
  if (reason === "Present") {
    return {
      rowClassName: "",
      badgeClassName: "border-emerald-950/10 bg-white/75 text-zinc-600",
    };
  }

  return {
    rowClassName:
      "border-rose-300 bg-linear-to-r from-rose-100 via-orange-50 to-white shadow-md shadow-rose-950/10",
    badgeClassName:
      "border-rose-600 bg-rose-600 text-white shadow-sm shadow-rose-950/20",
  };
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
  const [selectedPersonnelKeys, setSelectedPersonnelKeys] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [platoonFilter, setPlatoonFilter] = useState(ALL_PLATOONS_VALUE);
  const [bulkReason, setBulkReason] = useState<ConductAttendanceReason>("Present");
  const [bulkRemarks, setBulkRemarks] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoMarking, setIsAutoMarking] = useState(false);
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);
  const [dirtyPersonnelKeys, setDirtyPersonnelKeys] = useState<string[]>([]);
  const dirtyPersonnelKeysRef = useRef<Set<string>>(new Set());
  const lastConductIdRef = useRef<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const conductId = conduct?._id ?? null;

    if (!open || !conductId) {
      setDraftByKey({});
      setSelectedPersonnelKeys([]);
      setSearchValue("");
      setPlatoonFilter(ALL_PLATOONS_VALUE);
      setBulkReason("Present");
      setBulkRemarks("");
      setHasAttemptedSave(false);
      dirtyPersonnelKeysRef.current.clear();
      setDirtyPersonnelKeys([]);
      lastConductIdRef.current = null;
      return;
    }

    if (!attendanceState) {
      return;
    }

    const incomingDraft = buildDraftState(attendanceState);

    if (lastConductIdRef.current !== conductId) {
      setDraftByKey(incomingDraft);
      setSelectedPersonnelKeys([]);
      setSearchValue("");
      setPlatoonFilter(ALL_PLATOONS_VALUE);
      setBulkReason("Present");
      setBulkRemarks("");
      setHasAttemptedSave(false);
      dirtyPersonnelKeysRef.current.clear();
      setDirtyPersonnelKeys([]);
      lastConductIdRef.current = conductId;
      return;
    }

    setDraftByKey((current) => {
      const next = { ...incomingDraft };

      for (const personnelKey of dirtyPersonnelKeysRef.current) {
        if (Object.hasOwn(current, personnelKey)) {
          next[personnelKey] = current[personnelKey];
        } else {
          delete next[personnelKey];
        }
      }

      return next;
    });
  }, [attendanceState, conduct?._id, open]);
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
  const filteredPersonnelKeys = filteredPersonnel.map((person) => person.personnelKey);
  const filteredPersonnelKeySet = new Set(filteredPersonnelKeys);
  const selectedPersonnelKeySet = new Set(selectedPersonnelKeys);
  const nonPresentEntries = Object.entries(draftByKey);
  const invalidDirtyOtherKeys = dirtyPersonnelKeys.filter((personnelKey) => {
    const entry = draftByKey[personnelKey];

    return entry?.reason === "Other" && !entry.remarks.trim();
  });
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
  const filteredNonPresentCount = filteredPersonnelKeys.filter((personnelKey) =>
    Object.hasOwn(draftByKey, personnelKey),
  ).length;
  const filteredSelectedCount = selectedPersonnelKeys.filter((personnelKey) =>
    filteredPersonnelKeySet.has(personnelKey),
  ).length;
  const filteredPresentCount = Math.max(
    filteredPersonnel.length - filteredNonPresentCount,
    0,
  );
  const allFilteredSelected =
    filteredPersonnel.length > 0 &&
    filteredSelectedCount === filteredPersonnel.length;
  const someFilteredSelected =
    filteredSelectedCount > 0 && filteredSelectedCount < filteredPersonnel.length;
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
    invalidDirtyOtherKeys.length === 0 &&
    (attendanceState.snapshotRows.length > 0 || !livePersonnelError);
  const bulkRequiresRemarks = bulkReason === "Other" && !bulkRemarks.trim();
  const canApplyBulk =
    selectedPersonnelKeys.length > 0 &&
    !bulkRequiresRemarks &&
    !isSaving &&
    !isAutoMarking;

  function markDirty(personnelKey: string) {
    dirtyPersonnelKeysRef.current.add(personnelKey);
    setDirtyPersonnelKeys(Array.from(dirtyPersonnelKeysRef.current));
  }

  function clearDirty() {
    dirtyPersonnelKeysRef.current.clear();
    setDirtyPersonnelKeys([]);
  }

  function setReason(personnelKey: string, reason: ConductAttendanceReason) {
    markDirty(personnelKey);

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
    markDirty(personnelKey);

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

  function toggleSelectedPersonnel(personnelKey: string) {
    setSelectedPersonnelKeys((current) =>
      current.includes(personnelKey)
        ? current.filter((key) => key !== personnelKey)
        : [...current, personnelKey],
    );
  }

  function handlePersonnelSelectionKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    personnelKey: string,
  ) {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    toggleSelectedPersonnel(personnelKey);
  }

  function selectAllFilteredPersonnel() {
    if (filteredPersonnelKeys.length === 0) {
      return;
    }

    setSelectedPersonnelKeys((current) => [
      ...new Set([...current, ...filteredPersonnelKeys]),
    ]);
  }

  function unselectFilteredPersonnel() {
    if (filteredPersonnelKeys.length === 0) {
      return;
    }

    setSelectedPersonnelKeys((current) =>
      current.filter((key) => !filteredPersonnelKeySet.has(key)),
    );
  }

  function clearSelectedPersonnel() {
    setSelectedPersonnelKeys([]);
  }

  function applyBulkUpdate() {
    if (selectedPersonnelKeys.length === 0) {
      return;
    }

    if (bulkRequiresRemarks) {
      toast.error('Add remarks before applying a bulk "Other" status.');
      return;
    }

    for (const personnelKey of selectedPersonnelKeys) {
      dirtyPersonnelKeysRef.current.add(personnelKey);
    }
    setDirtyPersonnelKeys(Array.from(dirtyPersonnelKeysRef.current));

    setDraftByKey((current) => {
      const next = { ...current };

      for (const personnelKey of selectedPersonnelKeys) {
        if (bulkReason === "Present") {
          delete next[personnelKey];
          continue;
        }

        next[personnelKey] = {
          reason: bulkReason as ConductAttendancePersistedReason,
          remarks: bulkRemarks.trim(),
        };
      }

      return next;
    });

    toast.success(
      bulkReason === "Present"
        ? `Cleared attendance overrides for ${selectedPersonnelKeys.length} selected personnel.`
        : `Applied ${bulkReason} to ${selectedPersonnelKeys.length} selected personnel.`,
    );
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
      const autoMarkedDirtyKeys = response.attendanceEntries
        .filter((entry) => !Object.hasOwn(draftByKey, entry.personnelKey))
        .map((entry) => entry.personnelKey);

      for (const personnelKey of autoMarkedDirtyKeys) {
        dirtyPersonnelKeysRef.current.add(personnelKey);
      }

      if (autoMarkedDirtyKeys.length > 0) {
        setDirtyPersonnelKeys(Array.from(dirtyPersonnelKeysRef.current));
      }

      setDraftByKey((current) => {
        const next = { ...current };

        for (const entry of response.attendanceEntries) {
          if (Object.hasOwn(next, entry.personnelKey)) {
            continue;
          }

          next[entry.personnelKey] = {
            reason: entry.reason,
            remarks: entry.remarks ?? "",
          };
        }

        return next;
      });
      setHasAttemptedSave(false);
      toast.success("Auto-mark applied to currently present personnel only.");
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

    if (invalidDirtyOtherKeys.length > 0) {
      toast.error('Add remarks for every "Other" attendance row before saving.');
      return;
    }

    if (dirtyPersonnelKeys.length === 0) {
      toast.info("No attendance changes to save.");
      return;
    }

    setIsSaving(true);

    try {
      await saveConductAttendance({
        conductId: conduct._id,
        attendanceUpdates: dirtyPersonnelKeys.map((personnelKey) => {
          const entry = draftByKey[personnelKey];

          if (!entry) {
            return { personnelKey, reason: "Present" as const };
          }

          return {
            personnelKey,
            reason: entry.reason,
            remarks: entry.remarks.trim() || undefined,
          };
        }),
        nominalRollSeed:
          attendanceState.snapshotRows.length > 0 ? undefined : livePersonnelSeed,
      });
      clearDirty();
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
            <div className="grid gap-3 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
              <div className="rounded-[24px] border border-emerald-950/10 bg-white/80 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-900/55">
                  Posted
                </p>
                <p className="mt-1 text-xl font-semibold text-zinc-950">
                  {counts.nominalRollCount.toString().padStart(2, "0")}
                </p>
              </div>
              <div className="rounded-[24px] border border-emerald-950/10 bg-emerald-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-900/55">
                  Participating
                </p>
                <p className="mt-1 text-xl font-semibold text-emerald-900">
                  {counts.presentCount.toString().padStart(2, "0")}
                </p>
              </div>
              <div className="rounded-[24px] border border-rose-950/10 bg-rose-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-rose-900/55">
                  Non-Participants
                </p>
                <p className="mt-1 text-xl font-semibold text-rose-900">
                  {counts.nonPresentCount.toString().padStart(2, "0")}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-full min-h-0 rounded-[24px] border-emerald-950/10 bg-white/80 px-4 py-3 text-left"
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
                <div className="space-y-4 rounded-[28px] border border-emerald-950/10 bg-[#fbfaf4] p-4">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
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

                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
                    <Badge
                      variant="outline"
                      className="border-emerald-950/10 bg-white/85 text-zinc-700"
                    >
                      Filtered: {filteredPersonnel.length}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-emerald-950/10 bg-emerald-50 text-emerald-900"
                    >
                      Participating: {filteredPresentCount}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-rose-950/10 bg-rose-50 text-rose-900"
                    >
                      Non-Participants: {filteredNonPresentCount}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-emerald-950/10 bg-white/85 text-zinc-700"
                    >
                      Selected: {selectedPersonnelKeys.length}
                    </Badge>
                    {filteredSelectedCount !== selectedPersonnelKeys.length ? (
                      <span>{filteredSelectedCount} selected in current filter</span>
                    ) : null}
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[minmax(0,220px)_auto_180px_minmax(0,1fr)_auto]">
                    <label className="flex min-h-7 items-center gap-2 rounded-xl border border-emerald-950/10 bg-white/85 px-3 py-2 text-sm text-zinc-700">
                      <Checkbox
                        checked={allFilteredSelected}
                        indeterminate={someFilteredSelected}
                        disabled={filteredPersonnel.length === 0}
                        aria-label="Select all filtered personnel"
                        onCheckedChange={(checked) => {
                          if (checked) {
                            selectAllFilteredPersonnel();
                            return;
                          }

                          unselectFilteredPersonnel();
                        }}
                      />
                      <span>
                        {allFilteredSelected || someFilteredSelected
                          ? "Deselect filtered"
                          : "Select filtered"}
                      </span>
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-emerald-950/10 bg-white/85"
                      onClick={clearSelectedPersonnel}
                      disabled={selectedPersonnelKeys.length === 0}
                    >
                      Clear selection
                    </Button>
                    <Select
                      value={bulkReason}
                      onValueChange={(value) =>
                        setBulkReason(value as ConductAttendanceReason)
                      }
                    >
                      <SelectTrigger
                        size="sm"
                        className="w-full rounded-xl border-emerald-950/10 bg-white/85"
                      >
                        <SelectValue placeholder="Bulk status" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDUCT_ATTENDANCE_REASON_VALUES.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={bulkRemarks}
                      onChange={(event) => setBulkRemarks(event.target.value)}
                      placeholder={
                        bulkReason === "Present"
                          ? "Default"
                          : bulkReason === "Other"
                            ? "Bulk remarks required for Other"
                            : "Optional bulk remarks"
                      }
                      className={cn(
                        "rounded-xl border-emerald-950/10 bg-white/85",
                        bulkRequiresRemarks &&
                          "border-red-300 focus-visible:ring-red-200",
                      )}
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-xl"
                      onClick={applyBulkUpdate}
                      disabled={!canApplyBulk}
                    >
                      Apply to selected
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredPersonnel.length > 0 ? (
                    filteredPersonnel.map((person) => {
                      const draftEntry = draftByKey[person.personnelKey];
                      const reason = getDraftReason(draftEntry);
                      const isSelected = selectedPersonnelKeySet.has(
                        person.personnelKey,
                      );
                      const statusTone = getAttendanceStatusTone(reason);
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
                            "rounded-[24px] border border-emerald-950/10 bg-white/90 p-3 shadow-sm shadow-emerald-950/5 transition",
                            isSelected && "ring-2 ring-emerald-300",
                            statusTone.rowClassName,
                          )}
                        >
                          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
                            <div
                              role="button"
                              tabIndex={0}
                              aria-pressed={isSelected}
                              aria-label={`${isSelected ? "Unselect" : "Select"} ${person.rank} ${person.name}`}
                              onClick={() =>
                                toggleSelectedPersonnel(person.personnelKey)
                              }
                              onKeyDown={(event) =>
                                handlePersonnelSelectionKeyDown(
                                  event,
                                  person.personnelKey,
                                )
                              }
                              className="min-h-8 cursor-pointer rounded-2xl px-1 py-0.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
                            >
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
                                <Badge
                                  variant="outline"
                                  className={statusTone.badgeClassName}
                                >
                                  {reason === "Present" ? "Participating" : reason}
                                </Badge>
                                {isSelected ? (
                                  <Badge
                                    variant="outline"
                                    className="border-emerald-700 bg-emerald-700 text-white shadow-sm shadow-emerald-950/15"
                                  >
                                    Selected
                                  </Badge>
                                ) : null}
                              </div>
                            </div>

                            <div className="space-y-1">
                              {/* <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                                Status
                              </p> */}
                              <Select
                                value={reason}
                                onValueChange={(value) =>
                                  setReason(
                                    person.personnelKey,
                                    value as ConductAttendanceReason,
                                  )
                                }
                              >
                                <SelectTrigger
                                  size="sm"
                                  className="w-full rounded-xl border-emerald-950/10 bg-white/85"
                                  aria-label={`Attendance reason for ${person.rank} ${person.name}`}
                                >
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
                            <div className="mt-3 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <Label htmlFor={`remarks-${person.personnelKey}`}>
                                  Remarks {reason === "Other" ? "(required)" : "(optional)"}
                                </Label>
                                {reason !== "Present" ? (
                                  <p className="text-xs text-zinc-500">
                                    Only non-present rows are saved.
                                  </p>
                                ) : null}
                              </div>
                              <Input
                                id={`remarks-${person.personnelKey}`}
                                value={draftEntry?.remarks ?? ""}
                                onChange={(event) =>
                                  setRemarks(person.personnelKey, event.target.value)
                                }
                                aria-label={`Remarks for ${person.rank} ${person.name}`}
                                placeholder={
                                  reason === "Other"
                                    ? "Explain the non-present status"
                                    : "Add details if needed"
                                }
                                className={cn(
                                  "rounded-xl border-emerald-950/10 bg-white/85",
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
