"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import {
  ClipboardCopy,
  Loader2,
  Pencil,
  RefreshCw,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { api } from "../../../convex/_generated/api";
import type { DutyAssignmentDoc } from "@/components/duties/types";
import { BulkSelectionList } from "@/components/parade-state/bulk-selection-list";
import { PersonnelMultiCombobox } from "@/components/parade-state/personnel-multi-combobox";
import { StatusBadge } from "@/components/parade-state/status-badge";
import type { ParadeStateRecordDoc } from "@/components/parade-state/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DateStepperField } from "@/components/ui/date-stepper-field";
import { FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { PERSONNEL_ROUTE_PATH } from "@/lib/constants";
import { copyTextToClipboard } from "@/lib/clipboard";
import {
  doesStatusAffectParadeState,
  isOtherStatus,
  shouldShowOutOfCampToggle,
  STATUS_VALUES,
  type Status,
} from "@/lib/constants";
import {
  getCurrentSingaporeTimeHHmm,
  getTodaySingaporeDateString,
  isValidTimeHHmm,
} from "@/lib/date";
import {
  buildParadeReportData,
  formatParadeReportText,
  type ParadeReportRecord,
} from "@/lib/parade-report";
import { personnelRecordSchema, type PersonnelRecord } from "@/lib/personnel";

type PersonnelRouteError = { error?: { code?: string; message?: string } };
const IN_CAMP_OVERRIDE_VALUE = "__IN_CAMP__" as const;
type PreviewOverrideStatus = Status | typeof IN_CAMP_OVERRIDE_VALUE;
type PreviewOverrideRecord = {
  personnelName: string;
  status: PreviewOverrideStatus;
  customStatus?: string;
  affectParadeState: boolean;
};

function normalizePersonnelName(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function ReportDateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <DateStepperField
      label="Parade Date"
      value={value}
      onChange={onChange}
    />
  );
}

async function copyToClipboard(value: string, successMessage: string) {
  await copyTextToClipboard(value);
  toast.success(successMessage);
}

export function ParadeReportBuilder({
  autoCopyOnReady = false,
}: {
  autoCopyOnReady?: boolean;
}) {
  const [selectedDate, setSelectedDate] = useState(getTodaySingaporeDateString());
  const [asAtTime, setAsAtTime] = useState(getCurrentSingaporeTimeHHmm());
  const [personnel, setPersonnel] = useState<PersonnelRecord[]>([]);
  const [personnelError, setPersonnelError] = useState<string | null>(null);
  const [personnelRefreshKey, setPersonnelRefreshKey] = useState(0);
  const [isPersonnelLoading, setIsPersonnelLoading] = useState(true);
  const [isCopying, setIsCopying] = useState(false);
  const [isPreviewEditorOpen, setIsPreviewEditorOpen] = useState(false);
  const [overridePersonnelKeys, setOverridePersonnelKeys] = useState<string[]>([]);
  const [overrideStatus, setOverrideStatus] =
    useState<PreviewOverrideStatus>(IN_CAMP_OVERRIDE_VALUE);
  const [overrideCustomStatus, setOverrideCustomStatus] = useState("");
  const [overrideAffectParadeState, setOverrideAffectParadeState] =
    useState(false);
  const [previewOverrides, setPreviewOverrides] = useState<
    Record<string, PreviewOverrideRecord>
  >({});
  const autoCopiedRef = useRef(false);

  const activeRecords = useQuery(
    api.paradeState.listActiveRecordsForDate,
    { date: selectedDate },
  ) as ParadeStateRecordDoc[] | undefined;
  const dutyAssignments = useQuery(api.duties.listAssignmentsForRange, {
    fromDate: selectedDate,
    toDate: selectedDate,
  }) as DutyAssignmentDoc[] | undefined;

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
  }, [personnelRefreshKey]);

  useEffect(() => {
    autoCopiedRef.current = false;
  }, [autoCopyOnReady]);

  const timeError =
    asAtTime.length > 0 && !isValidTimeHHmm(asAtTime)
      ? 'Use 24-hour "HHmm" format, for example 0830 or 1745.'
      : null;
  const isLoadingReport =
    isPersonnelLoading || activeRecords === undefined || dutyAssignments === undefined;
  const personnelByKey = useMemo(
    () => new Map(personnel.map((person) => [person.personnelKey, person])),
    [personnel],
  );
  const personnelByName = useMemo(
    () =>
      new Map(
        personnel.map((person) => [normalizePersonnelName(person.name), person]),
      ),
    [personnel],
  );
  const previewActiveRecords = useMemo(() => {
    if (activeRecords === undefined) {
      return undefined;
    }

    const overrideEntries = Object.values(previewOverrides);

    if (overrideEntries.length === 0) {
      return activeRecords;
    }

    const overriddenPersonnelNames = new Set(
      overrideEntries.map((override) => normalizePersonnelName(override.personnelName)),
    );
    const filteredRecords = activeRecords.filter(
      (record) => !overriddenPersonnelNames.has(normalizePersonnelName(record.name)),
    );
    const syntheticRecords: ParadeReportRecord[] = overrideEntries.flatMap(
      (override, index) => {
        if (override.status === IN_CAMP_OVERRIDE_VALUE) {
          return [];
        }

        const person = personnelByName.get(
          normalizePersonnelName(override.personnelName),
        );

        if (!person) {
          return [];
        }

        return [
          {
            personnelKey: person.personnelKey,
            rank: person.rank,
            name: person.name,
            platoon: person.platoon,
            designation: person.designation,
            status: override.status,
            customStatus: override.customStatus,
            isPermanent: false,
            affectParadeState: override.affectParadeState,
            startDate: selectedDate,
            endDate: selectedDate,
            remarks: undefined,
            createdAt: index,
            updatedAt: index,
          },
        ];
      },
    );

    return [...filteredRecords, ...syntheticRecords];
  }, [activeRecords, personnelByName, previewOverrides, selectedDate]);
  const previewOverrideEntries = useMemo(
    () =>
      Object.values(previewOverrides).sort((left, right) => {
        const leftPerson = personnelByName.get(
          normalizePersonnelName(left.personnelName),
        );
        const rightPerson = personnelByName.get(
          normalizePersonnelName(right.personnelName),
        );

        if (!leftPerson || !rightPerson) {
          return left.personnelName.localeCompare(right.personnelName);
        }

        return (
          leftPerson.rank.localeCompare(rightPerson.rank) ||
          leftPerson.name.localeCompare(rightPerson.name)
        );
      }),
    [personnelByName, previewOverrides],
  );
  const reportState = useMemo(() => {
    if (timeError) {
      return {
        data: null,
        text: "",
        error: timeError,
      };
    }

    if (personnelError && !personnel.length) {
      return {
        data: null,
        text: "",
        error: personnelError,
      };
    }

    if (
      !personnel.length ||
      previewActiveRecords === undefined ||
      dutyAssignments === undefined
    ) {
      return {
        data: null,
        text: "",
        error: null,
      };
    }

    try {
      const data = buildParadeReportData({
        personnel,
        activeRecords: previewActiveRecords,
        dutyAssignments,
        paradeDate: selectedDate,
        asAtTime,
      });

      return {
        data,
        text: formatParadeReportText(data),
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        text: "",
        error: error instanceof Error ? error.message : "Unable to build parade report.",
      };
    }
  }, [
    asAtTime,
    dutyAssignments,
    personnel,
    personnelError,
    previewActiveRecords,
    selectedDate,
    timeError,
  ]);

  useEffect(() => {
    if (
      !autoCopyOnReady ||
      autoCopiedRef.current ||
      !reportState.text ||
      isLoadingReport
    ) {
      return;
    }

    autoCopiedRef.current = true;

    void copyToClipboard(reportState.text, "Parade report copied to clipboard.").catch(
      (error) => {
        autoCopiedRef.current = false;
        toast.error(
          error instanceof Error
            ? error.message
            : "Unable to copy the parade report.",
        );
      },
    );
  }, [autoCopyOnReady, isLoadingReport, reportState.text]);

  async function handleCopy(message = "Parade report copied to clipboard.") {
    if (!reportState.text) {
      return;
    }

    setIsCopying(true);

    try {
      await copyToClipboard(reportState.text, message);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to copy the parade report.",
      );
    } finally {
      setIsCopying(false);
    }
  }

  function handleRefresh() {
    setPersonnelRefreshKey((value) => value + 1);
  }

  function handleSelectedDateChange(value: string) {
    setSelectedDate(value);
    setPreviewOverrides({});
    setOverridePersonnelKeys([]);
  }

  function handleOverrideStatusChange(value: PreviewOverrideStatus) {
    setOverrideStatus(value);

    if (value === IN_CAMP_OVERRIDE_VALUE) {
      setOverrideCustomStatus("");
      setOverrideAffectParadeState(false);
      return;
    }

    if (!isOtherStatus(value)) {
      setOverrideCustomStatus("");
    }

    if (!shouldShowOutOfCampToggle(value)) {
      setOverrideAffectParadeState(doesStatusAffectParadeState(value));
    }
  }

  function handleApplyPreviewOverride() {
    if (overridePersonnelKeys.length === 0) {
      toast.error("Select at least one serviceman to edit in the preview.");
      return;
    }

    if (
      overrideStatus !== IN_CAMP_OVERRIDE_VALUE &&
      isOtherStatus(overrideStatus) &&
      !overrideCustomStatus.trim()
    ) {
      toast.error('Enter the custom status for "Others".');
      return;
    }

    const resolvedAffectParadeState =
      overrideStatus === IN_CAMP_OVERRIDE_VALUE
        ? false
        : shouldShowOutOfCampToggle(overrideStatus)
          ? overrideAffectParadeState
          : doesStatusAffectParadeState(overrideStatus);

    const selectedPersonnel = overridePersonnelKeys
      .map((personnelKey) => personnelByKey.get(personnelKey))
      .filter((person): person is PersonnelRecord => person !== undefined);

    if (selectedPersonnel.length === 0) {
      toast.error("Selected personnel could not be resolved. Refresh and try again.");
      return;
    }

    setPreviewOverrides((current) => {
      const next = { ...current };

      for (const person of selectedPersonnel) {
        next[normalizePersonnelName(person.name)] = {
          personnelName: person.name,
          status: overrideStatus,
          customStatus:
            overrideStatus !== IN_CAMP_OVERRIDE_VALUE && isOtherStatus(overrideStatus)
              ? overrideCustomStatus.trim()
              : undefined,
          affectParadeState: resolvedAffectParadeState,
        };
      }

      return next;
    });
    setOverridePersonnelKeys([]);
  }

  function handleRemovePreviewOverride(personnelName: string) {
    setPreviewOverrides((current) => {
      const next = { ...current };
      delete next[normalizePersonnelName(personnelName)];
      return next;
    });
  }

  function handleClearPreviewOverrides() {
    setPreviewOverrides({});
  }

  const warnings = reportState.data?.warnings ?? [];
  const nominalRollCount =
    isPersonnelLoading && !personnel.length ? "--" : String(personnel.length);
  const selectedOverridePersonnelCount = overridePersonnelKeys.length;
  const previewOverrideCount = previewOverrideEntries.length;
  const shouldShowOverrideCustomStatus =
    overrideStatus !== IN_CAMP_OVERRIDE_VALUE && isOtherStatus(overrideStatus);
  const shouldShowOverrideImpactToggle =
    overrideStatus !== IN_CAMP_OVERRIDE_VALUE &&
    shouldShowOutOfCampToggle(overrideStatus);
  const canApplyPreviewOverride =
    overridePersonnelKeys.length > 0 &&
    (!shouldShowOverrideCustomStatus || !!overrideCustomStatus.trim());

  return (
    <div className="space-y-4">
      <Card className="border-emerald-950/10 bg-white/80 shadow-lg shadow-emerald-950/5 rounded-[30px]">
        <CardHeader className="border-b border-emerald-950/10">
          <CardTitle>
            Parade State 
            <Badge variant="outline" className="ml-3">Nominal Roll {nominalRollCount}</Badge>
          </CardTitle>
          <CardDescription>
            A copy-ready parade-state message.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto]">
            <ReportDateField
              value={selectedDate}
              onChange={handleSelectedDateChange}
            />

            <FormItem>
              <FormLabel htmlFor="parade-time">As At</FormLabel>
              <Input
                id="parade-time"
                inputMode="numeric"
                maxLength={4}
                value={asAtTime}
                onChange={(event) =>
                  setAsAtTime(event.target.value.replace(/\D/g, "").slice(0, 4))
                }
                placeholder="HHmm"
                className="h-10"
              />
              <FormMessage>{timeError}</FormMessage>
            </FormItem>

            <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-2 md:flex">
              <Button
                type="button"
                variant="outline"
                onClick={handleRefresh}
                disabled={isPersonnelLoading}
                className="h-10 w-full md:flex-1"
              >
                {isPersonnelLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Refresh
              </Button>
              <Button
                type="button"
                onClick={() => void handleCopy("Parade report copied again.")}
                disabled={!reportState.text || isCopying}
                className="h-10 w-full md:flex-1"
              >
                {isCopying ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ClipboardCopy className="size-4" />
                )}
                Copy
              </Button>
            </div>
          </div>

          {personnelError ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Personnel refresh failed: {personnelError}
            </div>
          ) : null}

          {warnings.length > 0 ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <TriangleAlert className="size-4" />
                Warnings
              </div>
              <ul className="space-y-1">
                {warnings.map((warning) => (
                  <li key={warning}>• {warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-emerald-950/10 bg-white/80 shadow-lg shadow-emerald-950/5 rounded-[30px]">
        <CardHeader className="border-b border-emerald-950/10">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                Review the generated message before copying it into WhatsApp or your
                ops channel.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {previewOverrideCount > 0 ? (
                <Badge
                  variant="outline"
                  className="border-amber-300 bg-amber-50 text-amber-950"
                >
                  {previewOverrideCount} temporary override
                  {previewOverrideCount === 1 ? "" : "s"}
                </Badge>
              ) : null}
              <Button
                type="button"
                variant={isPreviewEditorOpen ? "secondary" : "outline"}
                onClick={() => setIsPreviewEditorOpen((value) => !value)}
                className="h-9"
              >
                <Pencil className="size-4" />
                Edit preview
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {isPreviewEditorOpen ? (
            <div className="mb-4 rounded-2xl border border-emerald-950/10 bg-emerald-950/[0.03] p-4">
              <div className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-950">
                      Temporary preview overrides
                    </p>
                    <p className="text-sm text-zinc-600">
                      These changes only affect this preview and copied text. They are
                      not saved to parade state.
                    </p>
                  </div>
                  {previewOverrideCount > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleClearPreviewOverrides}
                      className="h-8 px-2 text-zinc-600"
                    >
                      Clear all
                    </Button>
                  ) : null}
                </div>

                <div className="grid gap-3 md:grid-cols-[minmax(0,1.3fr)_220px_auto]">
                  <FormItem>
                    <FormLabel>Servicemen</FormLabel>
                    <PersonnelMultiCombobox
                      personnel={personnel}
                      value={overridePersonnelKeys}
                      onChange={setOverridePersonnelKeys}
                      disabled={isPersonnelLoading || personnel.length === 0}
                    />
                  </FormItem>

                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      value={overrideStatus}
                      onValueChange={(value) =>
                        handleOverrideStatusChange(value as PreviewOverrideStatus)
                      }
                    >
                      <SelectTrigger className="h-10 w-full bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={IN_CAMP_OVERRIDE_VALUE}>
                          In Camp
                        </SelectItem>
                        {STATUS_VALUES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>

                  <div className="flex items-end">
                    <Button
                      type="button"
                      onClick={handleApplyPreviewOverride}
                      disabled={!canApplyPreviewOverride}
                      className="h-10 w-full"
                    >
                      Apply
                    </Button>
                  </div>
                </div>

                {shouldShowOverrideCustomStatus || shouldShowOverrideImpactToggle ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {shouldShowOverrideCustomStatus ? (
                      <FormItem>
                        <FormLabel htmlFor="preview-custom-status">Custom status</FormLabel>
                        <Input
                          id="preview-custom-status"
                          value={overrideCustomStatus}
                          placeholder="Type the status to display"
                          onChange={(event) => setOverrideCustomStatus(event.target.value)}
                          className="h-10 bg-white"
                        />
                      </FormItem>
                    ) : (
                      <div />
                    )}

                    {shouldShowOverrideImpactToggle ? (
                      <FormItem>
                        <FormLabel>Out of camp?</FormLabel>
                        <div className="flex h-10 items-center justify-between rounded-lg border border-input bg-white px-3">
                          <span className="text-sm text-zinc-700">
                            Treat this override as out of camp
                          </span>
                          <Switch
                            checked={overrideAffectParadeState}
                            onCheckedChange={setOverrideAffectParadeState}
                          />
                        </div>
                      </FormItem>
                    ) : null}
                  </div>
                ) : null}

                {selectedOverridePersonnelCount > 0 ? (
                  <p className="text-xs text-zinc-500">
                    Editing {selectedOverridePersonnelCount}{" "}
                    {selectedOverridePersonnelCount === 1
                      ? "serviceman"
                      : "servicemen"}{" "}
                    for the current preview only. Matching is based on name.
                  </p>
                ) : null}

                <BulkSelectionList
                  personnel={personnel}
                  selectedKeys={overridePersonnelKeys}
                  onRemove={(personnelKey) => {
                    setOverridePersonnelKeys((current) =>
                      current.filter((key) => key !== personnelKey),
                    );
                  }}
                />

                {previewOverrideCount > 0 ? (
                  <div className="space-y-2">
                    {previewOverrideEntries.map((override) => {
                      const person = personnelByName.get(
                        normalizePersonnelName(override.personnelName),
                      );

                      if (!person) {
                        return null;
                      }

                      return (
                        <div
                          key={normalizePersonnelName(override.personnelName)}
                          className="flex flex-col gap-3 rounded-xl border border-emerald-950/10 bg-white px-3 py-3 md:flex-row md:items-center md:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-zinc-950">
                              {person.rank} {person.name}
                            </p>
                            <p className="truncate text-xs text-zinc-500">
                              {person.platoon}
                              {person.designation ? ` / ${person.designation}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 self-start md:self-center">
                            {override.status === IN_CAMP_OVERRIDE_VALUE ? (
                              <Badge className="bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200">
                                In Camp
                              </Badge>
                            ) : (
                              <>
                                <StatusBadge
                                  status={override.status}
                                  customStatus={override.customStatus}
                                />
                                <Badge
                                  variant="outline"
                                  className={
                                    override.affectParadeState
                                      ? "border-rose-200 bg-rose-50 text-rose-950"
                                      : "border-emerald-200 bg-emerald-50 text-emerald-950"
                                  }
                                >
                                  {override.affectParadeState ? "Out of Camp" : "In Camp"}
                                </Badge>
                              </>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemovePreviewOverride(override.personnelName)}
                              className="size-8 text-zinc-500"
                              aria-label={`Remove temporary override for ${person.rank} ${person.name}`}
                            >
                              <X className="size-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-emerald-950/15 px-3 py-4 text-sm text-zinc-500">
                    No temporary overrides applied.
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {isLoadingReport ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-2/5 rounded-xl" />
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
          ) : reportState.error ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {reportState.error}
            </div>
          ) : reportState.data ? (
            <div className="rounded-2xl border border-emerald-950/10 bg-emerald-950/[0.03] p-4">
              <pre className="overflow-x-auto whitespace-pre-wrap text-sm leading-6 text-zinc-900">
                {reportState.text}
              </pre>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Waiting for live data to build the report.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
