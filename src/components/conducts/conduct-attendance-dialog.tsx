"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { api } from "../../../convex/_generated/api";
import { PersonnelMultiCombobox } from "@/components/personnel/personnel-multi-combobox";
import type {
  ConductAttendanceState,
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
import { FormItem, FormLabel } from "@/components/ui/form";
import { cn } from "@/lib/utils";

function StatusBanner({
  status,
  livePersonnelError,
}: {
  status: ConductAttendanceState["snapshotStatus"];
  livePersonnelError: string | null;
}) {
  if (status === "futureLocked") {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Attendance can only be initialized on the actual conduct date.
      </div>
    );
  }

  if (status === "pastLocked") {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        This past conduct date has no saved nominal-roll snapshot, so first-save is blocked.
      </div>
    );
  }

  if (livePersonnelError) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Live nominal roll is unavailable: {livePersonnelError}
      </div>
    );
  }

  return null;
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
  const setConductAbsentees = useMutation(api.conducts.setConductAbsentees);
  const attendanceState = useQuery(
    api.conducts.getConductAttendanceState,
    open && conduct ? { conductId: conduct._id } : "skip",
  ) as ConductAttendanceState | undefined;
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) {
      setSelectedKeys([]);
      return;
    }

    if (attendanceState) {
      setSelectedKeys(attendanceState.absenteePersonnelKeys);
    }
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
  const selectedPersonnel = selectedKeys
    .map((key) => basePersonnel.find((person) => person.personnelKey === key))
    .filter((person): person is ConductNominalRollSeed => person !== undefined);
  const nominalRollCount = basePersonnel.length;
  const missedCount = selectedKeys.length;
  const participatingCount = Math.max(nominalRollCount - missedCount, 0);
  const isLocked =
    attendanceState?.snapshotStatus === "futureLocked" ||
    attendanceState?.snapshotStatus === "pastLocked";
  const canSave =
    !!conduct &&
    !!attendanceState &&
    !isLocked &&
    !livePersonnelLoading &&
    !isSaving &&
    (attendanceState.snapshotRows.length > 0 || !livePersonnelError);

  async function handleSave() {
    if (!conduct || !attendanceState) {
      return;
    }

    setIsSaving(true);

    try {
      await setConductAbsentees({
        conductId: conduct._id,
        absenteePersonnelKeys: selectedKeys,
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
      <DialogContent className="max-h-[calc(100svh-1rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {conduct ? `${conduct.name} Attendance` : "Conduct Attendance"}
          </DialogTitle>
          <DialogDescription>
            Everyone is treated as participating by default. Only select the people who missed the conduct.
          </DialogDescription>
        </DialogHeader>

        {!attendanceState ? (
          <div className="flex min-h-48 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-emerald-950/10 bg-white/75 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-900/55">
                  Posted
                </p>
                <p className="mt-1 text-2xl font-semibold text-zinc-950">
                  {nominalRollCount.toString().padStart(2, "0")}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-950/10 bg-emerald-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-900/55">
                  Participating
                </p>
                <p className="mt-1 text-2xl font-semibold text-emerald-900">
                  {participatingCount.toString().padStart(2, "0")}
                </p>
              </div>
              <div className="rounded-2xl border border-rose-950/10 bg-rose-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-rose-900/55">
                  Missed
                </p>
                <p className="mt-1 text-2xl font-semibold text-rose-900">
                  {missedCount.toString().padStart(2, "0")}
                </p>
              </div>
            </div>

            <StatusBanner
              status={attendanceState.snapshotStatus}
              livePersonnelError={
                attendanceState.snapshotRows.length > 0 ? null : livePersonnelError
              }
            />

            {!isLocked ? (
              <>
                <div className="grid gap-4">
                  <FormItem>
                    <FormLabel>Non-Participating Personnel</FormLabel>
                    <PersonnelMultiCombobox
                      personnel={basePersonnel}
                      value={selectedKeys}
                      onChange={setSelectedKeys}
                      disabled={livePersonnelLoading && attendanceState.snapshotRows.length === 0}
                      emptySelectionLabel="Select non-participants"
                      getSingleSelectionLabel={(person) => person.name}
                      getMultiSelectionLabel={(count) =>
                        `${count} non-participants selected`
                      }
                      searchPlaceholder="Search rank, name, or platoon..."
                      getSearchText={(person) =>
                        `${person.rank} ${person.name} ${person.platoon}`
                      }
                      getSecondaryText={(person) => person.platoon}
                      enablePlatoonFilter
                    />
                  </FormItem>
                </div>

                {selectedPersonnel.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-zinc-900">
                        Selected non-participants
                      </p>
                      <Badge variant="outline">{selectedPersonnel.length}</Badge>
                    </div>
                    <div className="flex max-h-32 flex-wrap content-start gap-1.5 overflow-y-auto rounded-xl pr-1">
                      {selectedPersonnel.map((person) => (
                        <div
                          key={person.personnelKey}
                          className={cn(
                            "flex max-w-full items-center gap-1 rounded-full border border-rose-950/10 bg-rose-950/[0.05] py-1 pl-2 pr-1 text-[10px] leading-none text-zinc-700",
                          )}
                        >
                          <span className="min-w-0 truncate whitespace-nowrap">
                            {person.rank} {person.name} / {person.platoon}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedKeys((current) =>
                                current.filter((key) => key !== person.personnelKey),
                              )
                            }
                            className="flex size-4 shrink-0 items-center justify-center rounded-full bg-rose-950/8 text-zinc-500 transition-colors hover:bg-rose-950/12 hover:text-zinc-800"
                            aria-label={`Remove ${person.rank} ${person.name}`}
                          >
                            <X className="size-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-emerald-950/15 bg-white/55 px-4 py-5 text-sm text-zinc-600">
                    No one marked as missing. Saving now records full participation for this conduct.
                  </div>
                )}
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
