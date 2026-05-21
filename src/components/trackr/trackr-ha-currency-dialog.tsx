"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { z } from "zod";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SINGAPORE_TIME_ZONE } from "@/lib/constants";
import {
  dateStringToDayIndex,
  getTodaySingaporeDateString,
} from "@/lib/date";
import {
  trackrHaCurrencyUnitResponseSchema,
  type TrackrHaCurrencyUnitResponse,
  type TrackrHaCurrencyUser,
} from "@/lib/trackr-schema";
import { cn } from "@/lib/utils";

const ALL_BRACKETS_VALUE = "__all_brackets__";
const ALL_UNITS_VALUE = "__all_units__";

const singaporeDateStringFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SINGAPORE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const fullDateFormatter = new Intl.DateTimeFormat("en-SG", {
  timeZone: SINGAPORE_TIME_ZONE,
  year: "numeric",
  month: "short",
  day: "numeric",
});

type HaCurrencyBracket = "current" | "expiring" | "expired" | "not-subscribed";
type HaCurrencyBracketFilter = typeof ALL_BRACKETS_VALUE | HaCurrencyBracket;

const routeErrorSchema = z.object({
  error: z
    .object({
      code: z.string().optional(),
      message: z.string().optional(),
    })
    .optional(),
});

function getApiErrorMessage(value: unknown) {
  const parsed = routeErrorSchema.safeParse(value);

  if (parsed.success && parsed.data.error?.message) {
    return parsed.data.error.message;
  }

  return "Unexpected Trackr route error.";
}

function getHaCurrencyBracket(user: TrackrHaCurrencyUser): HaCurrencyBracket {
  const normalizedStatus = user.status.toLowerCase();
  const daysUntilExpiry = getDaysUntilExpiry(user);

  if (normalizedStatus.includes("lapsed") || normalizedStatus.includes("expired")) {
    return "expired";
  }

  if (daysUntilExpiry === null) {
    return "not-subscribed";
  }

  if (daysUntilExpiry < 0) {
    return "expired";
  }

  if (daysUntilExpiry <= 7) {
    return "expiring";
  }

  return "current";
}

function getBracketLabel(bracket: HaCurrencyBracket) {
  switch (bracket) {
    case "current":
      return "Current";
    case "expiring":
      return "Expiring Soon";
    case "expired":
      return "Expired";
    case "not-subscribed":
      return "Not subscribed";
  }
}

function getBracketClassName(bracket: HaCurrencyBracket) {
  switch (bracket) {
    case "current":
      return "border-emerald-950/10 bg-emerald-50 text-emerald-900";
    case "expiring":
      return "border-amber-950/10 bg-amber-50 text-amber-950";
    case "expired":
      return "border-red-950/10 bg-red-50 text-red-900";
    case "not-subscribed":
      return "border-zinc-950/10 bg-zinc-100 text-zinc-700";
  }
}

function getSingaporeDateStringFromTimestamp(value: string) {
  return singaporeDateStringFormatter.format(new Date(value));
}

function getDaysUntilExpiry(user: TrackrHaCurrencyUser) {
  if (!user.expiryDate) {
    return user.daysToExpiry;
  }

  try {
    return (
      dateStringToDayIndex(getSingaporeDateStringFromTimestamp(user.expiryDate)) -
      dateStringToDayIndex(getTodaySingaporeDateString())
    );
  } catch {
    return user.daysToExpiry;
  }
}

function formatFullExpiryDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return fullDateFormatter.format(new Date(value));
}

function getCurrencyValidityCopy(user: TrackrHaCurrencyUser) {
  const bracket = getHaCurrencyBracket(user);
  const daysUntilExpiry = getDaysUntilExpiry(user);
  const expiryDate = formatFullExpiryDate(user.expiryDate);

  if (bracket === "not-subscribed" || daysUntilExpiry === null) {
    return {
      summary: "No expiry recorded",
      description: "No active HA currency",
      expiryDate,
    };
  }

  if (daysUntilExpiry < 0 || bracket === "expired") {
    const daysExpired = Math.abs(daysUntilExpiry);

    return {
      summary:
        daysExpired === 1 ? "Expired 1 day ago" : `Expired ${daysExpired} days ago`,
      description: `Expired on ${expiryDate}`,
      expiryDate,
    };
  }

  return {
    summary:
      daysUntilExpiry === 0
        ? "Expires today"
        : daysUntilExpiry === 1
          ? "1 more day remaining"
          : `${daysUntilExpiry} more days remaining`,
    description: `Current until ${expiryDate}`,
    expiryDate,
  };
}

function sortHaCurrencyUsers(users: TrackrHaCurrencyUser[]) {
  const bracketRank: Record<HaCurrencyBracket, number> = {
    expired: 0,
    expiring: 1,
    current: 2,
    "not-subscribed": 3,
  };

  return [...users].sort((left, right) => {
    const leftBracket = getHaCurrencyBracket(left);
    const rightBracket = getHaCurrencyBracket(right);
    const bracketCompare = bracketRank[leftBracket] - bracketRank[rightBracket];

    if (bracketCompare !== 0) {
      return bracketCompare;
    }

    const leftDays = getDaysUntilExpiry(left) ?? Number.POSITIVE_INFINITY;
    const rightDays = getDaysUntilExpiry(right) ?? Number.POSITIVE_INFINITY;
    const daysCompare = leftDays - rightDays;

    if (daysCompare !== 0) {
      return daysCompare;
    }

    return left.name.localeCompare(right.name);
  });
}

export function TrackrHaCurrencyDialog({
  open,
  onOpenChange,
  cookie,
  unitId,
  unitName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cookie: string;
  unitId: string;
  unitName: string;
}) {
  const [currencyData, setCurrencyData] =
    useState<TrackrHaCurrencyUnitResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [unitFilter, setUnitFilter] = useState(ALL_UNITS_VALUE);
  const [bracketFilter, setBracketFilter] =
    useState<HaCurrencyBracketFilter>(ALL_BRACKETS_VALUE);

  const handleLoadCurrency = useCallback(async () => {
    const requestCookie = cookie.trim();
    const requestUnitId = unitId.trim();

    if (!requestCookie) {
      setCurrencyData(null);
      setErrorMessage("Enter your Trackr cookie first.");
      return;
    }

    if (!requestUnitId) {
      setCurrencyData(null);
      setErrorMessage("Fetch OPFOR activities first so the OPFOR Trackr unit can be derived.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/trackr/currencies/ha/units/${encodeURIComponent(requestUnitId)}`,
        {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cookie: requestCookie,
          }),
        },
      );
      const json = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(getApiErrorMessage(json));
      }

      const parsed = trackrHaCurrencyUnitResponseSchema.safeParse(json);

      if (!parsed.success) {
        throw new Error("Trackr HA currency response shape was invalid.");
      }

      setCurrencyData(parsed.data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load Trackr HA currency.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [cookie, unitId]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) {
      return;
    }

    void handleLoadCurrency();
  }, [handleLoadCurrency, open]);

  useEffect(() => {
    setSearchTerm("");
    setUnitFilter(ALL_UNITS_VALUE);
    setBracketFilter(ALL_BRACKETS_VALUE);
  }, [unitId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const unitOptions = useMemo(() => {
    const unitNames = new Set(
      (currencyData?.users ?? []).map((user) => user.unitName).filter(Boolean),
    );

    return [...unitNames].sort((left, right) => left.localeCompare(right));
  }, [currencyData]);

  const bracketCounts = useMemo(() => {
    const counts: Record<HaCurrencyBracket, number> = {
      current: 0,
      expiring: 0,
      expired: 0,
      "not-subscribed": 0,
    };

    for (const user of currencyData?.users ?? []) {
      counts[getHaCurrencyBracket(user)] += 1;
    }

    return counts;
  }, [currencyData]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return sortHaCurrencyUsers(currencyData?.users ?? []).filter((user) => {
      if (unitFilter !== ALL_UNITS_VALUE && user.unitName !== unitFilter) {
        return false;
      }

      const bracket = getHaCurrencyBracket(user);

      if (bracketFilter !== ALL_BRACKETS_VALUE && bracket !== bracketFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return (
        user.name.toLowerCase().includes(normalizedSearch) ||
        user.unitName.toLowerCase().includes(normalizedSearch) ||
        user.status.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [bracketFilter, currencyData, searchTerm, unitFilter]);

  const displayedUnitName = currencyData?.unitName ?? unitName;
  const hasActiveFilters =
    searchTerm.trim() !== "" ||
    unitFilter !== ALL_UNITS_VALUE ||
    bracketFilter !== ALL_BRACKETS_VALUE;
  const selectBracketFilter = (bracket: HaCurrencyBracket) => {
    setBracketFilter((current) =>
      current === bracket ? ALL_BRACKETS_VALUE : bracket,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-1rem)] overflow-y-auto bg-[#fbfaf4] sm:max-w-6xl">
        <DialogHeader className="pr-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg text-zinc-950">
                <Award className="size-5 text-emerald-800" />
                HA Currency
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-2xl leading-6">
                {displayedUnitName || "OPFOR"} currency loaded from Trackr unit{" "}
                <span className="font-mono text-xs text-zinc-600">
                  {unitId || "pending"}
                </span>
                .
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                void handleLoadCurrency();
              }}
              disabled={isLoading}
              className="w-fit rounded-xl border-emerald-950/10 bg-white/80"
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Refresh
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              aria-pressed={bracketFilter === "current"}
              onClick={() => {
                selectBracketFilter("current");
              }}
              className={cn(
                "rounded-lg border border-emerald-950/10 bg-white/80 p-3 text-left shadow-sm transition hover:border-emerald-700/30 hover:bg-emerald-50/50",
                bracketFilter === "current" &&
                  "border-emerald-700/40 bg-emerald-50 ring-2 ring-emerald-700/15",
              )}
            >
              <p className="text-xs font-semibold text-emerald-900/65">
                Current
              </p>
              <p className="mt-1 text-2xl font-semibold text-emerald-900">
                {currencyData?.stats.numCurrent ?? 0}
              </p>
              <p className="mt-1 text-xs text-zinc-600">&gt;7 days remaining</p>
            </button>
            <button
              type="button"
              aria-pressed={bracketFilter === "expiring"}
              onClick={() => {
                selectBracketFilter("expiring");
              }}
              className={cn(
                "rounded-lg border border-amber-950/10 bg-white/80 p-3 text-left shadow-sm transition hover:border-amber-700/30 hover:bg-amber-50/60",
                bracketFilter === "expiring" &&
                  "border-amber-700/40 bg-amber-50 ring-2 ring-amber-700/15",
              )}
            >
              <p className="text-xs font-semibold text-amber-900/75">
                Expiring
              </p>
              <p className="mt-1 text-2xl font-semibold text-amber-900">
                {currencyData?.stats.numExpiringSoon ?? 0}
              </p>
              <p className="mt-1 text-xs text-zinc-600">Within 7 days</p>
            </button>
            <button
              type="button"
              aria-pressed={bracketFilter === "expired"}
              onClick={() => {
                selectBracketFilter("expired");
              }}
              className={cn(
                "rounded-lg border border-red-950/10 bg-white/80 p-3 text-left shadow-sm transition hover:border-red-700/30 hover:bg-red-50/60",
                bracketFilter === "expired" &&
                  "border-red-700/40 bg-red-50 ring-2 ring-red-700/15",
              )}
            >
              <p className="text-xs font-semibold text-red-900/75">Expired</p>
              <p className="mt-1 text-2xl font-semibold text-red-900">
                {currencyData?.stats.numExpired ?? 0}
              </p>
              <p className="mt-1 text-xs text-zinc-600">Past expiry date</p>
            </button>
            <button
              type="button"
              aria-pressed={bracketFilter === "not-subscribed"}
              onClick={() => {
                selectBracketFilter("not-subscribed");
              }}
              className={cn(
                "rounded-lg border border-zinc-950/10 bg-white/80 p-3 text-left shadow-sm transition hover:border-zinc-700/30 hover:bg-zinc-50",
                bracketFilter === "not-subscribed" &&
                  "border-zinc-700/40 bg-zinc-50 ring-2 ring-zinc-700/15",
              )}
            >
              <p className="text-xs font-semibold text-zinc-600">
                Not subscribed
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-800">
                {currencyData?.stats.numNotSubscribed ?? 0}
              </p>
              <p className="mt-1 text-xs text-zinc-600">No active HA record</p>
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-emerald-950/10 bg-white/80 p-2 shadow-sm">
            <div className="grid min-w-[820px] grid-cols-[1.35fr_0.95fr_0.95fr_2.5rem] items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  id="trackr-ha-search"
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                  }}
                  placeholder="Name, unit, or status"
                  className="h-9 rounded-lg border-emerald-950/10 bg-white pl-9"
                />
              </div>

              <Select
                value={unitFilter}
                onValueChange={(value) => {
                  setUnitFilter(value ?? ALL_UNITS_VALUE);
                }}
              >
                <SelectTrigger
                  aria-label="Filter by unit"
                  className="h-9 w-full rounded-lg border-emerald-950/10 bg-white"
                >
                  <span className="truncate text-left">
                    {unitFilter === ALL_UNITS_VALUE ? "All units" : unitFilter}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_UNITS_VALUE}>All units</SelectItem>
                  {unitOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={bracketFilter}
                onValueChange={(value) => {
                  setBracketFilter(
                    (value ?? ALL_BRACKETS_VALUE) as HaCurrencyBracketFilter,
                  );
                }}
              >
                <SelectTrigger
                  aria-label="Filter by currency"
                  className="h-9 w-full rounded-lg border-emerald-950/10 bg-white"
                >
                  <span className="truncate text-left">
                    {bracketFilter === ALL_BRACKETS_VALUE
                      ? "All currency"
                      : getBracketLabel(bracketFilter)}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_BRACKETS_VALUE}>All currency</SelectItem>
                  <SelectItem value="current">
                    Current ({bracketCounts.current})
                  </SelectItem>
                  <SelectItem value="expiring">
                    Expiring Soon ({bracketCounts.expiring})
                  </SelectItem>
                  <SelectItem value="expired">
                    Expired ({bracketCounts.expired})
                  </SelectItem>
                  <SelectItem value="not-subscribed">
                    Not subscribed ({bracketCounts["not-subscribed"]})
                  </SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                aria-label="Clear filters"
                title="Clear filters"
                onClick={() => {
                  setSearchTerm("");
                  setUnitFilter(ALL_UNITS_VALUE);
                  setBracketFilter(ALL_BRACKETS_VALUE);
                }}
                disabled={!hasActiveFilters}
                className="size-9 rounded-lg border-emerald-950/10 bg-white"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {errorMessage ? (
            <div className="rounded-xl border border-red-300/70 bg-red-50/90 px-4 py-3 text-sm text-red-900">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <p>{errorMessage}</p>
              </div>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-xl border border-emerald-950/10 bg-white/85 shadow-sm">
            <div className="flex flex-col gap-1 border-b border-emerald-950/8 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-zinc-950">
                Troopers
              </p>
              <p className="text-xs text-zinc-600">
                Showing {filteredUsers.length} of {currencyData?.users.length ?? 0}
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow className="border-emerald-950/8">
                    <TableHead className="py-3 text-xs font-semibold text-emerald-900/65">
                      Name
                    </TableHead>
                    <TableHead className="py-3 text-xs font-semibold text-emerald-900/65">
                      Currency
                    </TableHead>
                    <TableHead className="py-3 text-xs font-semibold text-emerald-900/65">
                      Expires on
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && !currencyData ? (
                    <TableRow className="border-emerald-950/8">
                      <TableCell colSpan={3} className="py-12 text-center text-sm text-zinc-600">
                        Loading HA currency...
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length ? (
                    filteredUsers.map((user) => {
                      const bracket = getHaCurrencyBracket(user);
                      const validityCopy = getCurrencyValidityCopy(user);

                      return (
                        <TableRow key={user.id} className="border-emerald-950/8">
                          <TableCell className="py-3 align-top">
                            <p className="font-medium text-zinc-950">{user.name}</p>
                            <p className="mt-1 text-xs text-zinc-500">
                              {user.unitName}
                            </p>
                          </TableCell>
                          <TableCell className="py-3 align-top">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="outline"
                                className={cn("rounded-full", getBracketClassName(bracket))}
                              >
                                {getBracketLabel(bracket)}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 align-top">
                            <p className="font-medium text-zinc-900">
                              {validityCopy.description}
                            </p>
                            <p className="mt-1 font-mono text-xs text-zinc-500">
                              {validityCopy.summary}
                            </p>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow className="border-emerald-950/8">
                      <TableCell colSpan={3} className="py-12 text-center text-sm text-zinc-600">
                        {currencyData
                          ? "No troopers match the current filters."
                          : "Open this after fetching OPFOR activities to load HA currency."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter showCloseButton>
          <Button
            onClick={() => {
              void handleLoadCurrency();
            }}
            disabled={isLoading}
            className="min-w-32"
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Refresh
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
