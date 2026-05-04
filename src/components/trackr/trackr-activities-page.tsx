"use client";

import { useState, useSyncExternalStore } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Activity,
  Clock3,
  Database,
  Loader2,
  ShieldAlert,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatDateLabel } from "@/lib/date";
import { trackrActivitiesFetchResponseSchema } from "@/lib/trackr-schema";

const TRACKR_COOKIE_STORAGE_KEY = "revamp.trackr.cookie";
const TRACKR_COOKIE_TTL_MS = 45 * 60 * 1000;

const trackrActivitiesRouteSchema = z.object({
  error: z
    .object({
      code: z.string().optional(),
      message: z.string().optional(),
    })
    .optional(),
});

const storedTrackrCookieSchema = z.object({
  cookie: z.string(),
  expiresAt: z.number(),
});

function getApiErrorMessage(value: unknown) {
  const parsed = trackrActivitiesRouteSchema.safeParse(value);

  if (parsed.success && parsed.data.error?.message) {
    return parsed.data.error.message;
  }

  return "Unable to load Trackr activities.";
}

function readStoredTrackrCookie() {
  if (typeof window === "undefined") {
    return "";
  }

  const rawValue = window.localStorage.getItem(TRACKR_COOKIE_STORAGE_KEY);

  if (!rawValue) {
    return "";
  }

  const parsed = storedTrackrCookieSchema.safeParse(JSON.parse(rawValue) as unknown);

  if (!parsed.success || parsed.data.expiresAt <= Date.now()) {
    window.localStorage.removeItem(TRACKR_COOKIE_STORAGE_KEY);
    return "";
  }

  return parsed.data.cookie;
}

function persistTrackrCookie(cookie: string) {
  if (typeof window === "undefined") {
    return;
  }

  const trimmedCookie = cookie.trim();

  if (!trimmedCookie) {
    window.localStorage.removeItem(TRACKR_COOKIE_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    TRACKR_COOKIE_STORAGE_KEY,
    JSON.stringify({
      cookie: trimmedCookie,
      expiresAt: Date.now() + TRACKR_COOKIE_TTL_MS,
    }),
  );
}

function subscribeToTrackrCookieStore(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (
      event.storageArea === window.localStorage &&
      event.key === TRACKR_COOKIE_STORAGE_KEY
    ) {
      onStoreChange();
    }
  };

  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener("storage", handleStorage);
  };
}

export function TrackrActivitiesPage() {
  const importTrackrConducts = useMutation(api.trackrConducts.importTrackrConducts);
  const storedConducts = useQuery(api.trackrConducts.listTrackrConducts, {});
  const storedCookie = useSyncExternalStore(
    subscribeToTrackrCookieStore,
    readStoredTrackrCookie,
    () => "",
  );
  const [cookieInput, setCookieInput] = useState<string | null>(null);
  const [includePast, setIncludePast] = useState(true);
  const [lastFetchedCount, setLastFetchedCount] = useState(0);
  const [lastIgnoredCount, setLastIgnoredCount] = useState(0);
  const [lastImportedCount, setLastImportedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const conducts = storedConducts ?? [];
  const cookie = cookieInput ?? storedCookie;
  const hasCookieValue = cookie.trim().length > 0;
  const totalPages = Math.max(1, Math.ceil(conducts.length / 10));
  const currentPage = Math.min(page, totalPages);
  const paginatedConducts = conducts.slice((currentPage - 1) * 10, currentPage * 10);

  function handleStoreCookie() {
    if (!hasCookieValue) {
      return;
    }

    persistTrackrCookie(cookie);
    toast.success("Trackr cookie stored for 45 minutes.");
  }

  async function handleLoadActivities() {
    if (!cookie.trim()) {
      setErrorMessage("Enter your Trackr cookie first.");
      toast.error("Enter your Trackr cookie first.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/trackr/activities", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cookie,
          isPast: includePast,
        }),
      });
      const json = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(getApiErrorMessage(json));
      }

      const parsed = trackrActivitiesFetchResponseSchema.safeParse(json);

      if (!parsed.success) {
        throw new Error("Trackr activities response shape was invalid.");
      }

      setLastFetchedCount(parsed.data.fetchedCount);
      setLastIgnoredCount(parsed.data.ignoredCount);

      const importResult = await importTrackrConducts({
        activities: parsed.data.activities,
      });

      setLastImportedCount(importResult.importedCount);
      setPage(1);
      toast.success(
        `Imported ${importResult.importedCount} OPFOR conducts. Ignored ${parsed.data.ignoredCount} non-OPFOR activities.`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load Trackr activities.";

      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4">
        <Card className="border-emerald-950/10 bg-[linear-gradient(135deg,rgba(255,250,237,0.96),rgba(235,245,229,0.92))] shadow-[0_24px_70px_-42px_rgba(52,87,43,0.55)]">
          <CardHeader className="gap-3 border-b border-emerald-950/8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Badge className="border-none bg-emerald-950 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.26em] text-emerald-50">
                  Trackr intake
                </Badge>
                <CardTitle className="mt-3 text-xl text-zinc-950">
                  OPFOR conduct importer
                </CardTitle>
                <CardDescription className="mt-2 max-w-2xl text-sm leading-6 text-zinc-700">
                  Paste your browser cookie, fetch Trackr activities, discard
                  everything that is not OPFOR, and save the remaining conducts
                  into Convex.
                </CardDescription>
              </div>
              <div className="grid grid-cols-2 gap-2 align-center">
                <div className="rounded-2xl border border-emerald-950/10 bg-white/70 px-4 py-3 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-900/55">
                    Source
                  </p>
                  <p className="mt-2 font-mono text-xs text-zinc-700">
                    /api/v1/activities/units
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-950/10 bg-white/70 px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-900/55">
                    <Database className="size-3.5" />
                    Stored
                  </div>
                  <p className="mt-2 font-mono text-xs text-zinc-700">
                    {conducts.length}
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="space-y-2">
                <Label htmlFor="trackr-cookie" className="text-sm font-semibold text-zinc-900">
                  Browser cookie
                </Label>
                <Textarea
                  id="trackr-cookie"
                  value={cookie}
                  onChange={(event) => {
                    setCookieInput(event.target.value);
                  }}
                  placeholder="trackr.sid=... or paste the full Cookie header"
                  className="min-h-28 rounded-2xl border-emerald-950/10 bg-white/80 px-4 py-3 font-mono text-xs shadow-sm"
                />
                <p className="text-xs leading-5 text-zinc-600">
                  The cookie stays in this tab state unless you explicitly store
                  it. Stored cookies expire after 45 minutes.
                </p>
                {hasCookieValue ? (
                  <div className="pt-1">
                    <Button
                      variant="outline"
                      onClick={handleStoreCookie}
                      className="rounded-2xl border-emerald-950/10 bg-white/80"
                    >
                      Store cookie
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 lg:w-52">
                <div className="rounded-2xl border border-emerald-950/10 bg-white/80 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label
                        htmlFor="trackr-past-switch"
                        className="text-sm font-semibold text-zinc-900"
                      >
                        Include past
                      </Label>
                      <p className="mt-1 text-xs leading-5 text-zinc-600">
                        Uses `isPast=true` to pull historical activities.
                      </p>
                    </div>
                    <Switch
                      id="trackr-past-switch"
                      checked={includePast}
                      onCheckedChange={setIncludePast}
                    />
                  </div>
                </div>

                <Button
                  size="lg"
                  onClick={() => {
                    void handleLoadActivities();
                  }}
                  disabled={isLoading}
                  className="h-12 rounded-2xl bg-[linear-gradient(135deg,_rgba(38,71,31,1),_rgba(104,128,60,0.94))] text-white shadow-[0_18px_44px_-24px_rgba(53,83,36,0.78)] hover:bg-[linear-gradient(135deg,_rgba(41,76,33,1),_rgba(113,137,65,0.96))]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Importing
                    </>
                  ) : (
                    <>
                      <Database className="size-4" />
                      Fetch and save
                    </>
                  )}
                </Button>
              </div>
            </div>

            {errorMessage ? (
              <div className="rounded-2xl border border-red-300/70 bg-red-50/90 px-4 py-3 text-sm text-red-900">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                  <p>{errorMessage}</p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <Card className="border-emerald-950/10 bg-white/75 shadow-[0_22px_60px_-48px_rgba(44,74,36,0.75)] backdrop-blur">
        <CardHeader className="gap-3 border-b border-emerald-950/8 pb-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="text-lg text-zinc-950">
                OPFOR conduct ledger
              </CardTitle>
              <CardDescription className="mt-1 leading-6 text-zinc-700">
                Stored Convex records only!
              </CardDescription>
            </div>
            <p className="text-xs text-zinc-600">
              Latest fetch returned {lastFetchedCount} Trackr activities.
            </p>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow className="border-emerald-950/8">
                <TableHead className="py-4 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-900/55">
                  Activity Name
                </TableHead>
                <TableHead className="py-4 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-900/55">
                  Activity ID
                </TableHead>
                <TableHead className="py-4 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-900/55">
                  Date
                </TableHead>
                <TableHead className="py-4 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-900/55">
                  Conducting Unit
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedConducts.length ? (
                paginatedConducts.map((conduct) => (
                  <TableRow key={conduct._id} className="border-emerald-950/8">
                    <TableCell className="py-3 align-top">
                      <p className="max-w-sm whitespace-normal font-medium text-zinc-950">
                        {conduct.name}
                      </p>
                    </TableCell>
                    <TableCell className="py-3 align-top font-mono text-[11px] text-zinc-500">
                      {conduct.trackrActivityId}
                    </TableCell>
                    <TableCell className="py-3 align-top">
                      <div className="flex items-center gap-1.5 text-zinc-800">
                        <Clock3 className="size-3.5 text-zinc-500" />
                        <span>{formatDateLabel(conduct.date)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 align-top">
                      <Badge
                        variant="outline"
                        className="border-emerald-950/10 bg-[#f6f4ea] text-zinc-700"
                      >
                        {conduct.conductingUnitName}
                      </Badge>
                      <span>{conduct.conductingUnitId}</span>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="border-emerald-950/8">
                  <TableCell
                    colSpan={5}
                    className="py-12 text-center text-sm text-zinc-600"
                  >
                    Fetch Trackr activities to import OPFOR conducts into Convex.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between gap-3 border-t border-emerald-950/8 px-1 pt-4">
            <p className="text-xs text-zinc-600">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setPage((value) => Math.max(1, value - 1));
                }}
                disabled={currentPage <= 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPage((value) => Math.min(totalPages, value + 1));
                }}
                disabled={currentPage >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
