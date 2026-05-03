"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  ClipboardCopy,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { api } from "../../../convex/_generated/api";
import { ConductAttendanceDialog } from "@/components/conducts/conduct-attendance-dialog";
import { ConductFormDialog } from "@/components/conducts/conduct-form-dialog";
import { ConductWhatsappPreviewDialog } from "@/components/conducts/conduct-whatsapp-preview-dialog";
import type { ConductListItem, ConductNominalRollSeed } from "@/components/conducts/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DateStepperField } from "@/components/ui/date-stepper-field";
import { Skeleton } from "@/components/ui/skeleton";
import { PERSONNEL_ROUTE_PATH } from "@/lib/constants";
import { isConductEligiblePlatoon } from "@/lib/conduct-whatsapp";
import { formatDateLabel, getTodaySingaporeDateString } from "@/lib/date";
import {
  personnelRecordSchema,
  resolveCanonicalPlatoon,
  type PersonnelRecord,
} from "@/lib/personnel";

type PersonnelRouteError = { error?: { code?: string; message?: string } };

function getStatusTone(status: ConductListItem["snapshotStatus"]) {
  switch (status) {
    case "ready":
      return "border-emerald-950/10 bg-emerald-50 text-emerald-950";
    case "canInitializeToday":
      return "border-sky-950/10 bg-sky-50 text-sky-950";
    case "futureLocked":
    case "pastLocked":
      return "border-amber-950/10 bg-amber-50 text-amber-950";
  }
}

function getStatusLabel(status: ConductListItem["snapshotStatus"]) {
  switch (status) {
    case "ready":
      return "Snapshot ready";
    case "canInitializeToday":
      return "Ready to initialize today";
    case "futureLocked":
      return "Future date locked";
    case "pastLocked":
      return "Past snapshot missing";
  }
}

function mapNominalRollSeed(personnel: PersonnelRecord[]): ConductNominalRollSeed[] {
  return personnel
    .map((person) => {
      const platoon = resolveCanonicalPlatoon(person.platoon);

      return {
        personnelKey: person.personnelKey,
        rank: person.rank,
        name: person.name,
        platoon,
      };
    })
    .filter((person) => isConductEligiblePlatoon(person.platoon));
}

export function ConductsPage({
  canManageConducts,
  canManageAttendance,
}: {
  canManageConducts: boolean;
  canManageAttendance: boolean;
}) {
  const deleteConduct = useMutation(api.conducts.deleteConduct);
  const [selectedDate, setSelectedDate] = useState(getTodaySingaporeDateString());
  const [personnel, setPersonnel] = useState<PersonnelRecord[]>([]);
  const [personnelError, setPersonnelError] = useState<string | null>(null);
  const [isPersonnelLoading, setIsPersonnelLoading] = useState(true);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedConduct, setSelectedConduct] = useState<ConductListItem | null>(null);
  const [selectedWhatsappConductId, setSelectedWhatsappConductId] = useState<string | null>(null);
  const [whatsappPreviewInstanceKey, setWhatsappPreviewInstanceKey] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  const [isWhatsappPreviewOpen, setIsWhatsappPreviewOpen] = useState(false);
  const [deletingConductId, setDeletingConductId] = useState<string | null>(null);
  const conducts = useQuery(api.conducts.listConductsForDate, {
    date: selectedDate,
  }) as ConductListItem[] | undefined;
  const snapshotSummary = useQuery(api.conducts.getConductSnapshotSummaryForDate, {
    date: selectedDate,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadPersonnel() {
      setIsPersonnelLoading(true);

      try {
        const response = await fetch(PERSONNEL_ROUTE_PATH, {
          cache: "no-store",
        });
        const json = (await response.json()) as PersonnelRecord[] | PersonnelRouteError;

        if (!response.ok) {
          throw new Error(
            "error" in json && json.error?.message
              ? json.error.message
              : "Unable to load personnel.",
          );
        }

        const parsed = z.array(personnelRecordSchema).safeParse(json);

        if (!parsed.success) {
          throw new Error("Personnel response shape was invalid.");
        }

        if (!cancelled) {
          setPersonnel(parsed.data);
          setPersonnelError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setPersonnelError(
            error instanceof Error
              ? error.message
              : "Unable to load personnel from Google Sheets.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsPersonnelLoading(false);
        }
      }
    }

    void loadPersonnel();

    return () => {
      cancelled = true;
    };
  }, []);

  const nominalRollSeed = mapNominalRollSeed(personnel);
  const conductCount = conducts?.length ?? 0;
  const initializedCount =
    conducts?.filter((conduct) => conduct.hasAttendance).length ?? 0;
  const selectedWhatsappConduct =
    conducts?.find((conduct) => conduct._id === selectedWhatsappConductId) ?? null;

  function openCreateDialog() {
    setFormMode("create");
    setSelectedConduct(null);
    setIsFormOpen(true);
  }

  function openEditDialog(conduct: ConductListItem) {
    setFormMode("edit");
    setSelectedConduct(conduct);
    setIsFormOpen(true);
  }

  function openAttendanceDialog(conduct: ConductListItem) {
    setSelectedConduct(conduct);
    setIsAttendanceOpen(true);
  }

  function openWhatsappPreview(conduct: ConductListItem) {
    setSelectedWhatsappConductId(conduct._id);
    setWhatsappPreviewInstanceKey((value) => value + 1);
    setIsWhatsappPreviewOpen(true);
  }

  async function handleDelete(conduct: ConductListItem) {
    const confirmed = window.confirm(
      `Delete "${conduct.name}"? This will remove its saved attendance.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingConductId(conduct._id);

    try {
      await deleteConduct({
        conductId: conduct._id,
      });
      toast.success("Conduct deleted.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete conduct.",
      );
    } finally {
      setDeletingConductId(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-visible rounded-[30px] border-emerald-950/10 bg-white/80 shadow-lg shadow-emerald-950/5">
        <CardHeader className="border-b border-emerald-950/10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <Badge
                variant="outline"
                className="border-emerald-950/10 bg-white/70 text-emerald-900"
              >
                Conduct state board
              </Badge>
              <CardTitle className="text-xl text-zinc-950">
                Track conduct participation and export WhatsApp-ready state
              </CardTitle>
              <CardDescription className="max-w-3xl leading-6">
                Attendance is saved as non-participants only. The daily nominal-roll snapshot excludes Shark Platoon and is shared across all conducts on the same date.
              </CardDescription>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge
                  variant="outline"
                  className={
                    snapshotSummary === undefined
                      ? "border-emerald-950/10 bg-white/70 text-zinc-700"
                      : getStatusTone(snapshotSummary.snapshotStatus)
                  }
                >
                  {snapshotSummary === undefined
                    ? "Loading snapshot status"
                    : getStatusLabel(snapshotSummary.snapshotStatus)}
                </Badge>
              </div>
            </div>

            {canManageConducts ? (
              <Button type="button" size="lg" onClick={openCreateDialog}>
                <Plus className="size-4" />
                Create Conduct
              </Button>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-2">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_1fr]">
            <DateStepperField
              label="Selected Date"
              value={selectedDate}
              onChange={setSelectedDate}
            />

            <div className="grid gap-3 grid-cols-3">
              <div className="rounded-2xl border border-emerald-950/10 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-900/55">
                  Conducts
                </p>
                <p className="mt-1 text-2xl font-semibold text-zinc-950">
                  {conducts === undefined ? "--" : conductCount.toString().padStart(2, "0")}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-950/10 bg-white/75 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-900/55">
                  Initialized
                </p>
                <p className="mt-1 text-2xl font-semibold text-zinc-950">
                  {conducts === undefined ? "--" : initializedCount.toString().padStart(2, "0")}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-950/10 bg-white/75 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-900/55">
                  Eligible Nominal Roll
                </p>
                <p className="mt-1 text-2xl font-semibold text-zinc-950">
                  {isPersonnelLoading ? "--" : nominalRollSeed.length.toString().padStart(2, "0")}
                </p>
              </div>
            </div>
          </div>

          {personnelError ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Live nominal roll refresh failed: {personnelError}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {conducts === undefined ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="rounded-[26px] border-emerald-950/10 bg-white/80">
              <CardHeader>
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-72" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : conducts.length === 0 ? (
        <Card className="rounded-[26px] border-dashed border-emerald-950/15 bg-white/70">
          <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
            <UsersRound className="size-9 text-emerald-900/45" />
            <div className="space-y-1">
              <p className="text-base font-medium text-zinc-950">
                No conducts for {formatDateLabel(selectedDate)}
              </p>
              <p className="text-sm text-zinc-600">
                {canManageConducts
                  ? "Create the first conduct for this date to start attendance tracking."
                  : "No conduct definitions are available for this date yet."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {conducts.map((conduct) => (
            <Card
              key={conduct._id}
              className="rounded-[28px] border-emerald-950/10 bg-white/85 shadow-md shadow-emerald-950/5"
            >
              <CardHeader className="gap-3 border-b border-emerald-950/8 pb-4">
                <CardAction className="flex items-center gap-2">
                  {canManageConducts ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => openEditDialog(conduct)}
                        aria-label={`Edit ${conduct.name}`}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon-sm"
                        onClick={() => void handleDelete(conduct)}
                        disabled={deletingConductId === conduct._id}
                        aria-label={`Delete ${conduct.name}`}
                      >
                        {deletingConductId === conduct._id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </Button>
                    </>
                  ) : null}
                </CardAction>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base text-zinc-950">
                      {conduct.name}
                    </CardTitle>
                    <div className="inline-flex items-center rounded-full border border-emerald-950/10 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-900/70">
                      {conduct.numberOfPeriods} Period
                    </div>
                    {conduct.hasAttendance ? (
                      <Badge variant="secondary">Saved</Badge>
                    ) : null}
                  </div>
                  <CardDescription className="text-sm leading-5">
                    {conduct.description?.trim()
                      ? conduct.description
                      : "No operator notes added for this conduct."}
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                <div className="grid gap-2 grid-cols-3">
                  <div className="rounded-2xl border border-emerald-950/10 bg-emerald-50 px-3 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-900/55">
                      Participating
                    </p>
                    <p className="mt-1 text-sm font-semibold text-zinc-950">
                      {conduct.participantCount === null
                        ? "--"
                        : conduct.participantCount.toString().padStart(2, "0")}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-rose-950/10 bg-rose-50 px-3 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-900/55">
                      Non-Participating
                    </p>
                    <p className="mt-1 text-sm font-semibold text-zinc-950">
                      {conduct.hasAttendance
                        ? conduct.absenteeCount.toString().padStart(2, "0")
                        : "--"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-950/10 bg-white/75 px-3 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-900/55">
                      Posted
                    </p>
                    <p className="mt-1 text-sm font-semibold text-zinc-950">
                      {conduct.nominalRollCount === null
                        ? "--"
                        : conduct.nominalRollCount.toString().padStart(2, "0")}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {!conduct.hasAttendance &&
                  conduct.snapshotStatus === "pastLocked" ? (
                    <Badge variant="outline" className="bg-amber-50 text-amber-950">
                      <TriangleAlert className="size-3.5" />
                      Backdated first-save blocked
                    </Badge>
                  ) : null}
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  {canManageAttendance ? (
                    <Button
                      type="button"
                      onClick={() => openAttendanceDialog(conduct)}
                    >
                      {conduct.hasAttendance ? "View Attendance" : "Mark Missed"}
                    </Button>
                  ) : null}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openWhatsappPreview(conduct)}
                    disabled={!conduct.whatsappData}
                  >
                    <ClipboardCopy className="size-4" />
                    Preview WhatsApp
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConductFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        mode={formMode}
        initialDate={selectedDate}
        conduct={selectedConduct}
      />

      <ConductAttendanceDialog
        open={isAttendanceOpen}
        onOpenChange={setIsAttendanceOpen}
        conduct={selectedConduct}
        livePersonnelSeed={nominalRollSeed}
        livePersonnelLoading={isPersonnelLoading}
        livePersonnelError={personnelError}
      />

      <ConductWhatsappPreviewDialog
        key={whatsappPreviewInstanceKey}
        open={isWhatsappPreviewOpen}
        onOpenChange={(open) => {
          setIsWhatsappPreviewOpen(open);

          if (!open) {
            setSelectedWhatsappConductId(null);
          }
        }}
        conduct={selectedWhatsappConduct}
      />
    </div>
  );
}
