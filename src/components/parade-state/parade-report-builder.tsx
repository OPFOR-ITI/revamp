"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { format, parseISO } from "date-fns";
import {
  ClipboardCopy,
  Loader2,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { api } from "../../../convex/_generated/api";
import type { DutyAssignmentDoc } from "@/components/duties/types";
import type { ParadeStateRecordDoc } from "@/components/parade-state/types";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormDescription, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { PERSONNEL_ROUTE_PATH } from "@/lib/constants";
import {
  formatDateLabel,
  getCurrentSingaporeTimeHHmm,
  getTodaySingaporeDateString,
  isValidTimeHHmm,
} from "@/lib/date";
import {
  buildParadeReportData,
  formatParadeReportText,
} from "@/lib/parade-report";
import { personnelRecordSchema, type PersonnelRecord } from "@/lib/personnel";
import { cn } from "@/lib/utils";

type PersonnelRouteError = { error?: { code?: string; message?: string } };

function dateToString(value: Date) {
  return format(value, "yyyy-MM-dd");
}

function ReportDateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const selectedDate = parseISO(value);

  return (
    <FormItem>
      <FormLabel>Parade Date</FormLabel>
      <Popover>
        <PopoverTrigger
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-10 w-full justify-between px-3 text-left font-normal",
          )}
        >
          <span>{formatDateLabel(value)}</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(nextDate) => {
              if (nextDate) {
                onChange(dateToString(nextDate));
              }
            }}
          />
        </PopoverContent>
      </Popover>
    </FormItem>
  );
}

async function copyToClipboard(value: string, successMessage: string) {
  await navigator.clipboard.writeText(value);
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

    if (!personnel.length || activeRecords === undefined || dutyAssignments === undefined) {
      return {
        data: null,
        text: "",
        error: null,
      };
    }

    try {
      const data = buildParadeReportData({
        personnel,
        activeRecords,
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
    activeRecords,
    asAtTime,
    dutyAssignments,
    personnel,
    personnelError,
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

  const warnings = reportState.data?.warnings ?? [];
  const nominalRollCount =
    isPersonnelLoading && !personnel.length ? "--" : String(personnel.length);

  return (
    <div className="space-y-4">
      <Card className="border-emerald-950/10 bg-white/80 shadow-lg shadow-emerald-950/5">
        <CardHeader className="border-b border-emerald-950/10">
          <CardTitle>Parade Report</CardTitle>
          <CardDescription>
            Generate a copy-ready parade-state message from the live nominal roll,
            active Convex statuses, and same-day duty assignments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto]">
            <ReportDateField value={selectedDate} onChange={setSelectedDate} />

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

            <div className="flex items-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleRefresh}
                disabled={isPersonnelLoading}
                className="flex-1 h-10"
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
                className="flex-1 h-10"
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

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Nominal Roll {nominalRollCount}</Badge>
            <Badge variant="outline">Date {formatDateLabel(selectedDate)}</Badge>
            <Badge variant="outline">As At {asAtTime || "----"}hrs</Badge>
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

      <Card className="border-emerald-950/10 bg-white/80 shadow-lg shadow-emerald-950/5">
        <CardHeader className="border-b border-emerald-950/10">
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            Review the generated message before copying it into WhatsApp or your
            ops channel.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
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
