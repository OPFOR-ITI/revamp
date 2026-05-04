"use client";

import { useState, useSyncExternalStore } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import {
  ArrowUpRight,
  Check,
  ChevronsUpDown,
  Clock3,
  Database,
  Loader2,
  ShieldAlert,
  X,
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { formatDateLabel } from "@/lib/date";
import {
  trackrActivitiesFetchResponseSchema,
  trackrCreateActivitiesResponseSchema,
  trackrUsersQueryResponseSchema,
  type TrackrUser,
} from "@/lib/trackr-schema";
import { cn } from "@/lib/utils";

const TRACKR_COOKIE_STORAGE_KEY = "revamp.trackr.cookie";
const TRACKR_COOKIE_TTL_MS = 45 * 60 * 1000;
const TRACKR_DEFAULT_CATEGORY_ID = 34;
const TRACKR_DEFAULT_OPFOR_UNIT_NAME = "OPFOR";
const TRACKR_USERS_QUERY_URL = "https://app.trackr.gov.sg/api/v1/users/query";
const HARDCODED_TRACKR_USER_QUERY_PAYLOAD = {
  unitIds: [
    "6edc1c4f-7fd5-441a-910d-e6b70a38ae37",
    "7a6ddd58-2fc0-486d-bf1d-0cc14b7ef637",
    "ce2974a1-a448-459e-8db7-cb9172664dc5",
    "be0818e7-8c9f-491a-a31e-bbf35be0eb13",
    "e8f4f157-5aa4-4d68-95fc-b221c764c182",
    "9eb4afcb-199a-47db-9a12-504a3a9a4e5a",
    "0277c734-0bdb-4436-a5ea-de35ce994969",
    "dda2f20d-7d30-43be-8b06-e5ea073b7084",
    "6393d3e4-3449-443e-b8a6-5930a0ea5d2a",
    "d370caf4-adda-4785-ae92-166686629e88",
    "2d14f91d-e2fd-4d2f-8534-e5dace2b6517",
    "afb6c095-01ce-4074-b94e-a47f4ad20800",
    "947b7de4-4674-4a05-a606-a1ac346fae0e",
    "40edc77a-1bff-44fd-b908-78d82bf7ce1f",
    "24d181fc-b41c-4958-830e-bb79fd98fed1",
    "b7e6711b-7415-4104-ab47-216798fbfe1a",
    "ee7f7c2e-094e-44f8-8e2f-f0d6ac12ea17",
  ],
} as const;
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

function TrackrUserCombobox({
  users,
  value,
  onChange,
  disabled = false,
}: {
  users: TrackrUser[];
  value: string[];
  onChange: (nextValue: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedSet = new Set(value);
  const selectedUsers = value
    .map((userId) => users.find((user) => user.id === userId))
    .filter((user): user is TrackrUser => user !== undefined);
  const usersByUnit = Array.from(
    users.reduce((groups, user) => {
      const unitName = user.units[0]?.name.trim() || "Trackr Users";
      const existing = groups.get(unitName) ?? [];

      existing.push(user);
      groups.set(unitName, existing);

      return groups;
    }, new Map<string, TrackrUser[]>()),
  );

  function handleToggle(userId: string) {
    const next = new Set(selectedSet);

    if (next.has(userId)) {
      next.delete(userId);
    } else {
      next.add(userId);
    }

    onChange(Array.from(next));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex min-h-14 w-full items-start justify-between gap-3 rounded-2xl border border-[#1697a6] bg-white px-3 py-2 text-left shadow-[0_0_0_1px_rgba(22,151,166,0.08)] outline-none transition focus-visible:ring-3 focus-visible:ring-[#1697a6]/20 disabled:pointer-events-none disabled:opacity-50",
        )}
        disabled={disabled}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {selectedUsers.length ? (
            selectedUsers.map((user) => (
              <span
                key={user.id}
                className="inline-flex max-w-full items-center gap-1 rounded-md bg-[#e8f7fa] px-2 py-1 text-[11px] font-medium text-[#127f8c]"
              >
                <span className="truncate uppercase">{user.name}</span>
                <button
                  type="button"
                  className="inline-flex shrink-0 rounded-sm text-[#127f8c]/75 transition hover:text-[#127f8c] focus-visible:outline-none"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleToggle(user.id);
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  aria-label={`Remove ${user.name}`}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))
          ) : (
            <span className="py-1 text-sm text-zinc-500">
              Select Trackr users
            </span>
          )}
          <span
            aria-hidden="true"
            className="h-4 w-px shrink-0 bg-[#1697a6]/45"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          {value.length > 0 ? (
            <Badge
              variant="outline"
              className="border-[#1697a6]/20 bg-[#f2fbfc] text-[#127f8c]"
            >
              {value.length}
            </Badge>
          ) : null}
          <ChevronsUpDown className="mt-0.5 size-4 shrink-0 text-[#127f8c]/70" />
        </div>
      </PopoverTrigger>

      <PopoverContent className="w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-emerald-950/10 p-0 shadow-lg">
        <Command
          filter={(entryValue, search) => {
            const words = search.toLowerCase().split(/\s+/).filter(Boolean);
            const lowerValue = entryValue.toLowerCase();
            return words.every((word) => lowerValue.includes(word)) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Search Trackr users..." />
          <CommandList>
            <CommandEmpty>No matching Trackr users found.</CommandEmpty>
            {usersByUnit.map(([unitName, groupedUsers]) => (
              <CommandGroup
                key={unitName}
                heading={unitName}
                className="**:[[cmdk-group-heading]]:border-b **:[[cmdk-group-heading]]:border-emerald-950/8 **:[[cmdk-group-heading]]:bg-[#fbfaf4] **:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:py-2 **:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:tracking-[0.12em]"
              >
                {groupedUsers.map((user) => {
                  const isSelected = selectedSet.has(user.id);

                  return (
                    <CommandItem
                      key={user.id}
                      value={`${unitName} ${user.name}`}
                      onSelect={() => handleToggle(user.id)}
                      className={cn(
                        "rounded-none px-3 py-3 text-zinc-800",
                        isSelected && "bg-[#e6f3f5]",
                      )}
                    >
                      <Check
                        className={cn(
                          "size-4 text-zinc-700",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate font-medium">{user.name}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function TrackrActivitiesPage() {
  const importTrackrConducts = useMutation(api.trackrConducts.importTrackrConducts);
  const upsertTrackrConductFromCreate = useMutation(
    api.trackrConducts.upsertTrackrConductFromCreate,
  );
  const {
    results: loadedConducts,
    status: conductPaginationStatus,
    loadMore,
    isLoading: areConductsLoading,
  } = usePaginatedQuery(
    api.trackrConducts.listTrackrConducts,
    {},
    { initialNumItems: 10 },
  );
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
  const [cookieInput, setCookieInput] = useState<string | null>(null);
  const [includePast, setIncludePast] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedAttendanceConductId, setSelectedAttendanceConductId] =
    useState<string | null>(null);
  const [attendanceUsers, setAttendanceUsers] = useState<TrackrUser[]>([]);
  const [attendanceErrorMessage, setAttendanceErrorMessage] = useState<
    string | null
  >(null);
  const [selectedAttendanceUserIds, setSelectedAttendanceUserIds] = useState<
    string[]
  >([]);
  const [selectedConductId, setSelectedConductId] = useState<string>("");
  const [lastFetchedCount, setLastFetchedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingTrackrActivity, setIsCreatingTrackrActivity] = useState(false);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const conducts = loadedConducts;
  const cookie = cookieInput ?? storedCookie;
  const hasCookieValue = cookie.trim().length > 0;
  const selectedConduct =
    sourceConducts.find((conduct) => conduct._id === selectedConductId) ?? null;
  const selectedAttendanceConduct =
    conducts.find((conduct) => conduct._id === selectedAttendanceConductId) ?? null;
  const defaultConductingUnitId = conducts[0]?.conductingUnitId ?? "";
  const defaultConductingUnitName =
    conducts[0]?.conductingUnitName ?? TRACKR_DEFAULT_OPFOR_UNIT_NAME;
  const loadedPages = Math.max(1, Math.ceil(conducts.length / 10));
  const currentPage = Math.min(page, loadedPages);
  const paginatedConducts = conducts.slice((currentPage - 1) * 10, currentPage * 10);
  const canLoadMoreConducts = conductPaginationStatus === "CanLoadMore";
  const isLoadingMoreConducts =
    conductPaginationStatus === "LoadingFirstPage" ||
    conductPaginationStatus === "LoadingMore";
  const canLoadMoreSourceConducts = sourceConductPaginationStatus === "CanLoadMore";
  const isLoadingMoreSourceConducts =
    sourceConductPaginationStatus === "LoadingFirstPage" ||
    sourceConductPaginationStatus === "LoadingMore";

  function handleStoreCookie() {
    if (!hasCookieValue) {
      return;
    }

    persistTrackrCookie(cookie);
    toast.success("Trackr cookie stored for 45 minutes.");
  }

  function formatSourceConductLabel(conduct: {
    name: string;
    date: string;
    numberOfPeriods: number;
  }) {
    return `${conduct.name} · ${formatDateLabel(conduct.date)} · ${conduct.numberOfPeriods}P`;
  }

  function handlePreviousPage() {
    setPage((value) => Math.max(1, value - 1));
  }

  function handleNextPage() {
    const nextPage = currentPage + 1;
    const needsMoreRows = nextPage > loadedPages;

    if (needsMoreRows) {
      if (!canLoadMoreConducts) {
        return;
      }

      loadMore(10);
    }

    setPage(nextPage);
  }

  async function openAttendanceDialog(conductId: string) {
    if (!cookie.trim()) {
      toast.error("Enter your Trackr cookie first.");
      return;
    }

    setSelectedAttendanceConductId(conductId);
    setAttendanceUsers([]);
    setAttendanceErrorMessage(null);
    setSelectedAttendanceUserIds([]);
    setIsAttendanceLoading(true);

    try {
      const response = await fetch("/api/trackr/users/query", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cookie,
          payload: HARDCODED_TRACKR_USER_QUERY_PAYLOAD,
        }),
      });
      const json = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(getApiErrorMessage(json));
      }

      const parsed = trackrUsersQueryResponseSchema.safeParse(json);

      if (!parsed.success) {
        throw new Error("Trackr users response shape was invalid.");
      }

      setAttendanceUsers(parsed.data.users);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load Trackr users.";

      setAttendanceErrorMessage(message);
      toast.error(message);
    } finally {
      setIsAttendanceLoading(false);
    }
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
      const importResult = await importTrackrConducts({
        activities: parsed.data.activities,
      });

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

  async function handleCreateTrackrActivity() {
    if (!selectedConduct) {
      toast.error("Select a source conduct first.");
      return;
    }

    if (!cookie.trim()) {
      toast.error("Enter your Trackr cookie first.");
      return;
    }

    if (!defaultConductingUnitId.trim()) {
      toast.error(
        "No saved OPFOR Trackr unit id is available yet. Import OPFOR activities first.",
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
                name: selectedConduct.name,
                periods: selectedConduct.numberOfPeriods,
                date: `${selectedConduct.date}T10:00:00.000Z`,
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

      await upsertTrackrConductFromCreate({
        name: selectedConduct.name,
        trackrActivityId: createdActivityId,
        date: selectedConduct.date,
        conductingUnitName: defaultConductingUnitName,
        conductingUnitId: defaultConductingUnitId.trim(),
      });

      setIsCreateDialogOpen(false);
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
                    Loaded
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
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    setIsCreateDialogOpen(true);
                  }}
                  className="h-12 rounded-2xl border-emerald-950/10 bg-white/80"
                >
                  <ArrowUpRight className="size-4" />
                  Create in Trackr
                </Button>

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

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-h-[calc(100svh-1rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Trackr Activity</DialogTitle>
            <DialogDescription>
              Pick one of your existing local conducts. The Trackr activity uses
              its name, date, and period count. Category stays fixed at
              `{TRACKR_DEFAULT_CATEGORY_ID}` and the OPFOR unit comes from your
              saved OPFOR Trackr conducts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="trackr-source-conduct" className="text-sm font-semibold text-zinc-900">
                Source conduct
              </Label>
              <Select
                value={selectedConductId}
                onValueChange={(value) => {
                  setSelectedConductId(value ?? "");
                }}
              >
                <SelectTrigger
                  id="trackr-source-conduct"
                  className="h-11 w-full rounded-2xl border-emerald-950/10 bg-white/80 px-3"
                >
                  {selectedConduct ? (
                    <span className="line-clamp-1 text-left">
                      {selectedConduct.name} · {formatDateLabel(selectedConduct.date)}
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
                {selectedConduct ? (
                  <p className="text-xs text-zinc-600">
                    {selectedConduct.name} on {formatDateLabel(selectedConduct.date)} with{" "}
                    {selectedConduct.numberOfPeriods} period
                    {selectedConduct.numberOfPeriods === 1 ? "" : "s"}.
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
                  No saved OPFOR Trackr unit is available yet.
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

      <Dialog
        open={selectedAttendanceConduct !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAttendanceConductId(null);
            setAttendanceUsers([]);
            setAttendanceErrorMessage(null);
            setSelectedAttendanceUserIds([]);
            setIsAttendanceLoading(false);
          }
        }}
      >
        <DialogContent className="max-h-[calc(100svh-1rem)] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {selectedAttendanceConduct
                ? `${selectedAttendanceConduct.name} Attendance`
                : "Attendance"}
            </DialogTitle>
            <DialogDescription>
              Loaded from Trackr via{" "}
              <span className="font-mono text-[11px]">
                {TRACKR_USERS_QUERY_URL}
              </span>
              . Choose a returned user by name.
            </DialogDescription>
          </DialogHeader>

          {isAttendanceLoading ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-950/10 bg-white/70 px-4 py-10 text-sm text-zinc-600">
              <Loader2 className="size-4 animate-spin" />
              Loading attendance users...
            </div>
          ) : attendanceErrorMessage ? (
            <div className="rounded-2xl border border-red-300/70 bg-red-50/90 px-4 py-3 text-sm text-red-900">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <p>{attendanceErrorMessage}</p>
              </div>
            </div>
          ) : attendanceUsers.length ? (
            <div className="grid gap-4 rounded-2xl border border-emerald-950/10 bg-[#f6f4ea] p-4 text-sm text-zinc-700">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-900/55">
                    Attendance Users
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">
                    Names only. Selected values are stored by Trackr user ID.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="h-fit border-emerald-950/10 bg-white/80 text-zinc-700"
                >
                  {attendanceUsers.length} user
                  {attendanceUsers.length === 1 ? "" : "s"}
                </Badge>
              </div>

              <TrackrUserCombobox
                users={attendanceUsers}
                value={selectedAttendanceUserIds}
                onChange={setSelectedAttendanceUserIds}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-950/10 bg-white/70 px-4 py-10 text-center text-sm text-zinc-600">
              No users were returned for this payload.
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card className="border-emerald-950/10 bg-white/75 shadow-[0_22px_60px_-48px_rgba(44,74,36,0.75)] backdrop-blur">
        <CardHeader className="gap-3 border-b border-emerald-950/8 pb-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="text-lg text-zinc-950">
                OPFOR conduct ledger
              </CardTitle>
              <CardDescription className="mt-1 leading-6 text-zinc-700">
                Stored Convex records only. This page loads 10 rows first and
                fetches the next 10 only when you press Next.
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
                    <TableCell className="py-3 align-top">
                      <Button
                        variant="outline"
                        onClick={() => {
                          void openAttendanceDialog(conduct._id);
                        }}
                        disabled={
                          isAttendanceLoading &&
                          selectedAttendanceConductId === conduct._id
                        }
                        className="rounded-2xl border-emerald-950/10 bg-white/80"
                      >
                        {isAttendanceLoading &&
                        selectedAttendanceConductId === conduct._id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : null}
                        View Attendance
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
                    {areConductsLoading
                      ? "Loading OPFOR conducts..."
                      : "Fetch Trackr activities to import OPFOR conducts into Convex."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between gap-3 border-t border-emerald-950/8 px-1 pt-4">
            <p className="text-xs text-zinc-600">
              Page {currentPage}
            </p>
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
                disabled={
                  isLoadingMoreConducts ||
                  (currentPage >= loadedPages && !canLoadMoreConducts)
                }
              >
                {isLoadingMoreConducts ? "Loading..." : "Next"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
