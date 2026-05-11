"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { usePaginatedQuery } from "convex/react";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Database,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { api } from "../../../convex/_generated/api";
import { TrackrAttendanceUpdateDialog } from "@/components/trackr/trackr-attendance-update-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { PERSONNEL_ROUTE_PATH } from "@/lib/constants";
import { formatDateLabel } from "@/lib/date";
import {
  personnelRecordSchema,
  type PersonnelRecord,
} from "@/lib/personnel";
import {
  type TrackrActivity,
  trackrActivitiesFetchResponseSchema,
  trackrCreateActivitiesResponseSchema,
} from "@/lib/trackr-schema";

const TRACKR_COOKIE_STORAGE_KEY = "revamp.trackr.cookie";
const TRACKR_COOKIE_TTL_MS = 45 * 60 * 1000;
const TRACKR_DEFAULT_CATEGORY_ID = 34;
const TRACKR_DEFAULT_OPFOR_UNIT_NAME = "OPFOR";

const trackrRouteErrorSchema = z.object({
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
  const parsed = trackrRouteErrorSchema.safeParse(value);

  if (parsed.success && parsed.data.error?.message) {
    return parsed.data.error.message;
  }

  return "Unexpected Trackr route error.";
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

function formatSourceConductLabel(conduct: {
  name: string;
  date: string;
  numberOfPeriods: number;
}) {
  return `${conduct.name} · ${formatDateLabel(conduct.date)} · ${conduct.numberOfPeriods}P`;
}

function sortTrackrActivities(activities: TrackrActivity[]) {
  return [...activities].sort((left, right) => {
    const dateCompare = right.date.localeCompare(left.date);

    if (dateCompare !== 0) {
      return dateCompare;
    }

    return left.name.localeCompare(right.name);
  });
}

export function TrackrActivitiesPage() {
  const {
    results: sourceConducts,
    status: sourceConductPaginationStatus,
    loadMore: loadMoreSourceConducts,
  } = usePaginatedQuery(
    api.conducts.listConductsForTrackrCreate,
    {},
    { initialNumItems: 25 },
  );
  const storedCookie = useSyncExternalStore(
    subscribeToTrackrCookieStore,
    readStoredTrackrCookie,
    () => "",
  );
  const [hasMounted, setHasMounted] = useState(false);
  const [cookieInput, setCookieInput] = useState<string | null>(null);
  const [includePast, setIncludePast] = useState(true);
  const [personnel, setPersonnel] = useState<PersonnelRecord[]>([]);
  const [trackrActivities, setTrackrActivities] = useState<TrackrActivity[]>([]);
  const [isCookieDialogRequested, setIsCookieDialogRequested] = useState(false);
  const [isCookieDialogDismissed, setIsCookieDialogDismissed] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTrackrActivityId, setSelectedTrackrActivityId] = useState<
    string | null
  >(null);
  const [selectedCreateConductId, setSelectedCreateConductId] = useState("");
  const [lastFetchedCount, setLastFetchedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingTrackrActivity, setIsCreatingTrackrActivity] = useState(false);
  const [isPersonnelLoading, setIsPersonnelLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [personnelError, setPersonnelError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const autoFetchedCookieRef = useRef("");

  const cookie = cookieInput ?? storedCookie;
  const hasCookieValue = cookie.trim().length > 0;
  const hasStoredCookie = storedCookie.trim().length > 0;
  const shouldAutoOpenCookieDialog =
    hasMounted && !hasStoredCookie && cookieInput === null && !isCookieDialogDismissed;
  const isCookieDialogOpen =
    isCookieDialogRequested || shouldAutoOpenCookieDialog;
  const selectedCreateConduct =
    sourceConducts.find((conduct) => conduct._id === selectedCreateConductId) ?? null;
  const selectedTrackrActivity =
    trackrActivities.find((activity) => activity.id === selectedTrackrActivityId) ??
    null;
  const defaultConductingUnitId = trackrActivities[0]?.conductingUnit.id ?? "";
  const defaultConductingUnitName =
    trackrActivities[0]?.conductingUnit.name ?? TRACKR_DEFAULT_OPFOR_UNIT_NAME;
  const loadedPages = Math.max(1, Math.ceil(trackrActivities.length / 10));
  const currentPage = Math.min(page, loadedPages);
  const paginatedConducts = trackrActivities.slice(
    (currentPage - 1) * 10,
    currentPage * 10,
  );
  const canLoadMoreSourceConducts = sourceConductPaginationStatus === "CanLoadMore";
  const isLoadingMoreSourceConducts =
    sourceConductPaginationStatus === "LoadingFirstPage" ||
    sourceConductPaginationStatus === "LoadingMore";

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPersonnel() {
      setIsPersonnelLoading(true);

      try {
        const response = await fetch(PERSONNEL_ROUTE_PATH, {
          cache: "no-store",
        });
        const json = await response.json();

        if (!response.ok) {
          throw new Error(getApiErrorMessage(json));
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
            error instanceof Error ? error.message : "Unable to load personnel.",
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

  async function handleSaveCookieAndLoad() {
    const nextCookie = cookie.trim();

    if (!nextCookie) {
      toast.error("Enter your Trackr browser cookie first.");
      return;
    }

    persistTrackrCookie(nextCookie);
    setCookieInput(nextCookie);
    setIsCookieDialogRequested(false);
    setIsCookieDialogDismissed(false);
    toast.success("Trackr cookie stored for 45 minutes.");
    await handleLoadActivities(nextCookie);
  }

  function handlePreviousPage() {
    setPage((value) => Math.max(1, value - 1));
  }

  function handleNextPage() {
    if (currentPage >= loadedPages) {
      return;
    }

    setPage((value) => value + 1);
  }

  function openUpdateDialog(trackrActivityId: string) {
    if (!cookie.trim()) {
      toast.error("Enter your Trackr cookie first.");
      setIsCookieDialogRequested(true);
      return;
    }

    setSelectedTrackrActivityId(trackrActivityId);
  }

  const handleLoadActivities = useCallback(async (cookieOverride?: string) => {
    const requestCookie = (cookieOverride ?? cookie).trim();

    if (!requestCookie) {
      setErrorMessage("Enter your Trackr cookie first.");
      toast.error("Enter your Trackr cookie first.");
      setIsCookieDialogRequested(true);
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
          cookie: requestCookie,
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

      setTrackrActivities(sortTrackrActivities(parsed.data.activities));
      setLastFetchedCount(parsed.data.fetchedCount);
      setPage(1);
      toast.success(
        `Loaded ${parsed.data.activities.length} OPFOR activities. Ignored ${parsed.data.ignoredCount} non-OPFOR activities.`,
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
  }, [cookie, includePast]);

  useEffect(() => {
    if (
      !hasStoredCookie ||
      trackrActivities.length > 0 ||
      autoFetchedCookieRef.current === storedCookie
    ) {
      return;
    }

    autoFetchedCookieRef.current = storedCookie;
    void handleLoadActivities(storedCookie);
  }, [handleLoadActivities, hasStoredCookie, storedCookie, trackrActivities.length]);

  async function handleCreateTrackrActivity() {
    if (!selectedCreateConduct) {
      toast.error("Select a source conduct first.");
      return;
    }

    if (!cookie.trim()) {
      toast.error("Enter your Trackr cookie first.");
      setIsCookieDialogRequested(true);
      return;
    }

    if (!defaultConductingUnitId.trim()) {
      toast.error(
        "No OPFOR Trackr unit id is available yet. Fetch OPFOR activities first.",
      );
      return;
    }

    setIsCreatingTrackrActivity(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/trackr/activities/create", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cookie,
          payload: {
            activities: [
              {
                name: selectedCreateConduct.name,
                periods: selectedCreateConduct.numberOfPeriods,
                date: `${selectedCreateConduct.date}T10:00:00.000Z`,
                conductingUnitId: defaultConductingUnitId.trim(),
                description: null,
                categoryId: TRACKR_DEFAULT_CATEGORY_ID,
              },
            ],
          },
        }),
      });
      const json = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(getApiErrorMessage(json));
      }

      const parsed = trackrCreateActivitiesResponseSchema.safeParse(json);

      if (!parsed.success) {
        throw new Error("Trackr create-activity response shape was invalid.");
      }

      const createdActivityId = parsed.data.activityIds[0];

      if (!createdActivityId) {
        throw new Error("Trackr did not return an activity id.");
      }

      setTrackrActivities((current) =>
        sortTrackrActivities([
          {
            id: createdActivityId,
            name: selectedCreateConduct.name,
            periods: selectedCreateConduct.numberOfPeriods,
            date: `${selectedCreateConduct.date}T10:00:00.000Z`,
            conductingUnit: {
              id: defaultConductingUnitId.trim(),
              name: defaultConductingUnitName,
            },
            description: null,
            category: {
              id: TRACKR_DEFAULT_CATEGORY_ID,
              name: "Created Activity",
              isHa: false,
            },
            participatingUnits: [],
          },
          ...current.filter((activity) => activity.id !== createdActivityId),
        ]),
      );

      setIsCreateDialogOpen(false);
      setSelectedCreateConductId("");
      setPage(1);
      toast.success(parsed.data.message);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to create the Trackr activity.";

      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsCreatingTrackrActivity(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4">
        <Card className="border-emerald-950/10 bg-[linear-gradient(135deg,rgba(255,250,237,0.96),rgba(235,245,229,0.92))] shadow-[0_24px_70px_-42px_rgba(52,87,43,0.55)]">
          <CardHeader className="gap-3 border-b border-emerald-950/8 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Badge className="border-none bg-emerald-950 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.26em] text-emerald-50">
                  Trackr intake
                </Badge>
                <CardTitle className="mt-3 text-xl text-zinc-950">
                  OPFOR conduct importer
                </CardTitle>
                <CardDescription className="mt-2 max-w-xl text-sm leading-6 text-zinc-700">
                  Live Trackr OPFOR results, kept lean. Cookie setup now happens
                  only when the session needs it.
                </CardDescription>
              </div>
              <div className="grid grid-cols-2 gap-2 align-center sm:grid-cols-3">
                <div className="rounded-xl border border-emerald-950/10 bg-white/70 px-3 py-2 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-900/55">
                    Session
                  </p>
                  <p className="mt-1 font-mono text-xs text-zinc-700">
                    {hasCookieValue ? "Cookie ready" : "Needs cookie"}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-950/10 bg-white/70 px-3 py-2 shadow-sm">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-900/55">
                    <Database className="size-3.5" />
                    Loaded
                  </div>
                  <p className="mt-1 font-mono text-xs text-zinc-700">
                    {trackrActivities.length}
                  </p>
                </div>
                <div className="col-span-2 rounded-xl border border-emerald-950/10 bg-white/70 px-3 py-2 shadow-sm sm:col-span-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-900/55">
                    Source
                  </p>
                  <p className="mt-1 truncate font-mono text-xs text-zinc-700">
                    /api/v1/activities/units
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3 rounded-xl border border-emerald-950/10 bg-white/70 px-3 py-2">
                <Switch
                  id="trackr-past-switch"
                  checked={includePast}
                  onCheckedChange={setIncludePast}
                />
                <div>
                  <Label
                    htmlFor="trackr-past-switch"
                    className="text-sm font-semibold text-zinc-900"
                  >
                    Include past activities
                  </Label>
                  <p className="text-xs text-zinc-600">
                    Stored cookies expire after 45 minutes.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCookieInput(cookie);
                    setIsCookieDialogDismissed(false);
                    setIsCookieDialogRequested(true);
                  }}
                  className="rounded-xl border-emerald-950/10 bg-white/80"
                >
                  <KeyRound className="size-4" />
                  Cookie
                  {hasStoredCookie ? (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  ) : null}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(true);
                  }}
                  className="rounded-xl border-emerald-950/10 bg-white/80"
                >
                  <ArrowUpRight className="size-4" />
                  Create in Trackr
                </Button>
                <Button
                  onClick={() => {
                    void handleLoadActivities();
                  }}
                  disabled={isLoading}
                  className="rounded-xl bg-[linear-gradient(135deg,_rgba(38,71,31,1),_rgba(104,128,60,0.94))] text-white shadow-[0_18px_44px_-24px_rgba(53,83,36,0.78)] hover:bg-[linear-gradient(135deg,_rgba(41,76,33,1),_rgba(113,137,65,0.96))]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Loading
                    </>
                  ) : (
                    <>
                      <RefreshCw className="size-4" />
                      Fetch activities
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

      <Dialog
        open={isCookieDialogOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            if (!shouldAutoOpenCookieDialog) {
              setIsCookieDialogRequested(true);
            }
            return;
          }

          setIsCookieDialogRequested(nextOpen);
          setIsCookieDialogDismissed(true);
        }}
      >
        <DialogContent className="max-h-[calc(100svh-1rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Connect Trackr Session</DialogTitle>
            <DialogDescription>
              Paste a fresh Trackr browser cookie. Saving stores it locally for
              45 minutes and immediately fetches OPFOR activities.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-950/10 bg-[#fbfaf4] p-4 text-sm text-zinc-700">
              <p className="font-semibold text-zinc-950">How to get the browser cookie</p>
              <ol className="mt-3 list-decimal space-y-2 pl-5 leading-6">
                <li>Open Trackr in your browser and sign in.</li>
                <li>Open Developer Tools, then go to the Application tab.</li>
                <li>In the sidebar, expand Cookies and select https://app.trackr.gov.sg.</li>
                <li>Find trackr.sid and copy its Value.</li>
              </ol>
              <p className="mt-3 text-xs leading-5 text-zinc-600">
                Paste the trackr.sid value here. The full Cookie header also works.
              </p>
            </div>

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
                className="min-h-28 rounded-xl border-emerald-950/10 bg-white/80 px-4 py-3 font-mono text-xs shadow-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCookieDialogRequested(false);
                setIsCookieDialogDismissed(true);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                void handleSaveCookieAndLoad();
              }}
              disabled={isLoading || !hasCookieValue}
              className="min-w-32"
            >
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Database className="size-4" />}
              Save and fetch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-h-[calc(100svh-1rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Trackr Activity</DialogTitle>
            <DialogDescription>
              Pick one of your existing local conducts. The Trackr activity uses
              its name, date, and period count. Category stays fixed at
              `{TRACKR_DEFAULT_CATEGORY_ID}` and the OPFOR unit comes from your
              most recently loaded OPFOR Trackr activities.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="trackr-source-conduct" className="text-sm font-semibold text-zinc-900">
                Source conduct
              </Label>
              <Select
                value={selectedCreateConductId}
                onValueChange={(value) => {
                  setSelectedCreateConductId(value ?? "");
                }}
              >
                <SelectTrigger
                  id="trackr-source-conduct"
                  className="h-11 w-full rounded-2xl border-emerald-950/10 bg-white/80 px-3"
                >
                  {selectedCreateConduct ? (
                    <span className="line-clamp-1 text-left">
                      {selectedCreateConduct.name} · {formatDateLabel(selectedCreateConduct.date)}
                    </span>
                  ) : (
                    <SelectValue placeholder="Select a local conduct" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {sourceConducts.map((conduct) => (
                    <SelectItem key={conduct._id} value={conduct._id}>
                      {formatSourceConductLabel(conduct)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                {canLoadMoreSourceConducts ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      loadMoreSourceConducts(25);
                    }}
                    disabled={isLoadingMoreSourceConducts}
                  >
                    {isLoadingMoreSourceConducts ? "Loading..." : "Load more conducts"}
                  </Button>
                ) : null}
                {selectedCreateConduct ? (
                  <p className="text-xs text-zinc-600">
                    {selectedCreateConduct.name} on{" "}
                    {formatDateLabel(selectedCreateConduct.date)} with{" "}
                    {selectedCreateConduct.numberOfPeriods} period
                    {selectedCreateConduct.numberOfPeriods === 1 ? "" : "s"}.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-950/10 bg-[#fbfaf4] p-4 text-sm text-zinc-700">
              <p>
                OPFOR unit: <span className="font-medium">{defaultConductingUnitName}</span>
              </p>
              {!defaultConductingUnitId ? (
                <p className="mt-1 text-xs text-zinc-500">
                  No loaded OPFOR Trackr unit is available yet.
                </p>
              ) : null}
            </div>
          </div>

          <DialogFooter showCloseButton>
            <Button
              onClick={() => {
                void handleCreateTrackrActivity();
              }}
              disabled={isCreatingTrackrActivity}
              className="min-w-32"
            >
              {isCreatingTrackrActivity ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowUpRight className="size-4" />
              )}
              Create in Trackr
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TrackrAttendanceUpdateDialog
        open={selectedTrackrActivity !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSelectedTrackrActivityId(null);
          }
        }}
        activity={selectedTrackrActivity}
        cookie={cookie}
        sourceConducts={sourceConducts}
        personnel={personnel}
        personnelError={personnelError}
        isPersonnelLoading={isPersonnelLoading}
        canLoadMoreSourceConducts={canLoadMoreSourceConducts}
        isLoadingMoreSourceConducts={isLoadingMoreSourceConducts}
        onLoadMoreSourceConducts={() => {
          loadMoreSourceConducts(25);
        }}
      />

      <Card className="border-emerald-950/10 bg-white/75 shadow-[0_22px_60px_-48px_rgba(44,74,36,0.75)] backdrop-blur">
        <CardHeader className="gap-3 border-b border-emerald-950/8 pb-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="text-lg text-zinc-950">
                OPFOR conduct ledger
              </CardTitle>
              <CardDescription className="mt-1 leading-6 text-zinc-700">
                Live Trackr results for this browser session. This page shows 10
                rows at a time after each fetch.
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
                <TableHead className="py-4 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-900/55">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedConducts.length ? (
                paginatedConducts.map((conduct) => (
                  <TableRow key={conduct.id} className="border-emerald-950/8">
                    <TableCell className="py-3 align-top">
                      <p className="max-w-sm whitespace-normal font-medium text-zinc-950">
                        {conduct.name}
                      </p>
                    </TableCell>
                    <TableCell className="py-3 align-top font-mono text-[11px] text-zinc-500">
                      {conduct.id}
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
                        {conduct.conductingUnit.name}
                      </Badge>
                      <span>{conduct.conductingUnit.id}</span>
                    </TableCell>
                    <TableCell className="py-3 align-top">
                      <Button
                        variant="outline"
                        onClick={() => {
                          openUpdateDialog(conduct.id);
                        }}
                        className="rounded-2xl border-emerald-950/10 bg-white/80"
                      >
                        Update Trackr
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="border-emerald-950/8">
                  <TableCell
                    colSpan={5}
                    className="py-12 text-center text-sm text-zinc-600"
                  >
                    {isLoading
                      ? "Loading OPFOR activities..."
                      : "Fetch Trackr activities to load live OPFOR results."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between gap-3 border-t border-emerald-950/8 px-1 pt-4">
            <p className="text-xs text-zinc-600">Page {currentPage}</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handlePreviousPage}
                disabled={currentPage <= 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={handleNextPage}
                disabled={currentPage >= loadedPages}
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
