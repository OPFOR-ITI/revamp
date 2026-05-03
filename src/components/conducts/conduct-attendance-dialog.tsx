"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { api } from "../../../convex/_generated/api";
import { ConductPersonnelMultiCombobox } from "@/components/conducts/conduct-personnel-multi-combobox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [selectedPlatoon, setSelectedPlatoon] = useState("all");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) {
      setSelectedPlatoon("all");
      setSelectedKeys([]);
      return;
    }

    if (attendanceState) {
      setSelectedKeys(attendanceState.absenteePersonnelKeys);
      setSelectedPlatoon("all");
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
  const pickerPersonnel =
    selectedPlatoon === "all"
      ? basePersonnel
      : basePersonnel.filter((person) => person.platoon === selectedPlatoon);
  const selectedPersonnel = selectedKeys
    .map((key) => basePersonnel.find((person) => person.personnelKey === key))
    .filter((person): person is ConductNominalRollSeed => person !== undefined);
  const platoonOptions =
    attendanceState?.platoonOptions.filter((platoon) =>
      basePersonnel.some((person) => person.platoon === platoon),
    ) ??
    [];
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
                <div className="grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
                  <FormItem>
                    <FormLabel>Platoon Filter</FormLabel>
                    <Select
                      value={selectedPlatoon}
                      onValueChange={(value) => setSelectedPlatoon(value ?? "all")}
                    >
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue placeholder="Select platoon" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All platoons</SelectItem>
                        {platoonOptions.map((platoon) => (
                          <SelectItem key={platoon} value={platoon}>
                            {platoon}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>

                  <FormItem>
                    <FormLabel>Non-Participating Personnel</FormLabel>
                    <ConductPersonnelMultiCombobox
                      personnel={pickerPersonnel}
                      value={selectedKeys}
                      onChange={setSelectedKeys}
                      disabled={livePersonnelLoading && attendanceState.snapshotRows.length === 0}
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
                    <div className="flex flex-col gap-1.5">
                      {selectedPersonnel.map((person) => (
                        <div
                          key={person.personnelKey}
                          className={cn(
                            "group flex items-center gap-2 rounded-lg border border-rose-950/10 bg-rose-950/[0.03] px-3 py-2 text-sm text-zinc-700",
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {person.rank} {person.name} / {person.platoon}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedKeys((current) =>
                                current.filter((key) => key !== person.personnelKey),
                              )
                            }
                            className="shrink-0 rounded-md p-0.5 text-zinc-400 opacity-0 transition-opacity hover:text-zinc-700 group-hover:opacity-100"
                            aria-label={`Remove ${person.rank} ${person.name}`}
                          >
                            <X className="size-3.5" />
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
