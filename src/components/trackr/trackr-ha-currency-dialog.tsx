"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Award,
  ChevronDown,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { z } from "zod";

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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
type SelectableHaCurrencyBracket = Exclude<HaCurrencyBracket, "not-subscribed">;
type HaCurrencySortKey = "name" | "unit" | "currency";
type SortDirection = "asc" | "desc";

const CURRENCY_FILTER_OPTIONS: SelectableHaCurrencyBracket[] = [
  "current",
  "expiring",
  "expired",
];

const SORT_CURRENCY_RANK: Record<HaCurrencyBracket, number> = {
  current: 0,
  expiring: 1,
  expired: 2,
  "not-subscribed": 3,
};

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

function sortHaCurrencyUsersByKey(
  users: TrackrHaCurrencyUser[],
  key: HaCurrencySortKey | null,
  direction: SortDirection,
) {
  if (!key) {
    return sortHaCurrencyUsers(users);
  }

  const directionMultiplier = direction === "asc" ? 1 : -1;

  return [...users].sort((left, right) => {
    let compare = 0;

    if (key === "name") {
      compare = left.name.localeCompare(right.name);
    }

    if (key === "unit") {
      compare = left.unitName.localeCompare(right.unitName);
    }

    if (key === "currency") {
      compare =
        SORT_CURRENCY_RANK[getHaCurrencyBracket(left)] -
        SORT_CURRENCY_RANK[getHaCurrencyBracket(right)];
    }

    if (compare !== 0) {
      return compare * directionMultiplier;
    }

    return left.name.localeCompare(right.name);
  });
}

function getSortAriaLabel(
  label: string,
  key: HaCurrencySortKey,
  activeKey: HaCurrencySortKey | null,
  direction: SortDirection,
) {
  if (activeKey !== key) {
    return `Sort by ${label} ascending`;
  }

  return `Sort by ${label} ${direction === "asc" ? "descending" : "ascending"}`;
}

function SortIcon({
  column,
  activeColumn,
  direction,
}: {
  column: HaCurrencySortKey;
  activeColumn: HaCurrencySortKey | null;
  direction: SortDirection;
}) {
  if (column !== activeColumn) {
    return <ArrowUpDown className="size-3.5 text-zinc-400" />;
  }

  return direction === "asc" ? (
    <ArrowUp className="size-3.5 text-emerald-800" />
  ) : (
    <ArrowDown className="size-3.5 text-emerald-800" />
  );
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
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [selectedBrackets, setSelectedBrackets] = useState<
    SelectableHaCurrencyBracket[]
  >([]);
  const [sortKey, setSortKey] = useState<HaCurrencySortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

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
    setSelectedUnits([]);
    setSelectedBrackets([]);
    setSortKey(null);
    setSortDirection("asc");
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

    const users = (currencyData?.users ?? []).filter((user) => {
      if (selectedUnits.length > 0 && !selectedUnits.includes(user.unitName)) {
        return false;
      }

      const bracket = getHaCurrencyBracket(user);

      if (
        selectedBrackets.length > 0 &&
        !selectedBrackets.includes(bracket as SelectableHaCurrencyBracket)
      ) {
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

    return sortHaCurrencyUsersByKey(users, sortKey, sortDirection);
  }, [
    currencyData,
    searchTerm,
    selectedBrackets,
    selectedUnits,
    sortDirection,
    sortKey,
  ]);

  const displayedUnitName = currencyData?.unitName ?? unitName;
  const hasActiveFilters =
    searchTerm.trim() !== "" ||
    selectedUnits.length > 0 ||
    selectedBrackets.length > 0;
  const toggleUnitFilter = (unit: string) => {
    setSelectedUnits((current) =>
      current.includes(unit)
        ? current.filter((value) => value !== unit)
        : [...current, unit],
    );
  };
  const toggleBracketFilter = (bracket: SelectableHaCurrencyBracket) => {
    setSelectedBrackets((current) =>
      current.includes(bracket)
        ? current.filter((value) => value !== bracket)
        : [...current, bracket],
    );
  };
  const toggleSort = (key: HaCurrencySortKey) => {
    if (sortKey === key) {
      setSortDirection((currentDirection) =>
        currentDirection === "asc" ? "desc" : "asc",
      );
      return;
    }

    setSortDirection("asc");
    setSortKey(key);
  };
  const unitFilterLabel =
    selectedUnits.length === 0
      ? "All units"
      : selectedUnits.length === 1
        ? selectedUnits[0]
        : `${selectedUnits.length} units`;
  const currencyFilterLabel =
    selectedBrackets.length === 0
      ? "All currency"
      : selectedBrackets.length === 1
        ? getBracketLabel(selectedBrackets[0])
        : `${selectedBrackets.length} currency tags`;

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
                {displayedUnitName || "OPFOR"} currency loaded from Trackr unit: {" "}
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
          <div className="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              aria-pressed={selectedBrackets.includes("current")}
              onClick={() => {
                toggleBracketFilter("current");
              }}
              className={cn(
                "rounded-lg border border-emerald-950/10 bg-white/80 p-3 text-left shadow-sm transition hover:border-emerald-700/30 hover:bg-emerald-50/50",
                selectedBrackets.includes("current") &&
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
              aria-pressed={selectedBrackets.includes("expiring")}
              onClick={() => {
                toggleBracketFilter("expiring");
              }}
              className={cn(
                "rounded-lg border border-amber-950/10 bg-white/80 p-3 text-left shadow-sm transition hover:border-amber-700/30 hover:bg-amber-50/60",
                selectedBrackets.includes("expiring") &&
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
              aria-pressed={selectedBrackets.includes("expired")}
              onClick={() => {
                toggleBracketFilter("expired");
              }}
              className={cn(
                "rounded-lg border border-red-950/10 bg-white/80 p-3 text-left shadow-sm transition hover:border-red-700/30 hover:bg-red-50/60",
                selectedBrackets.includes("expired") &&
                  "border-red-700/40 bg-red-50 ring-2 ring-red-700/15",
              )}
            >
              <p className="text-xs font-semibold text-red-900/75">Expired</p>
              <p className="mt-1 text-2xl font-semibold text-red-900">
                {currencyData?.stats.numExpired ?? 0}
              </p>
              <p className="mt-1 text-xs text-zinc-600">Past expiry date</p>
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-emerald-950/10 bg-white/80 p-2 shadow-sm">
            <div
              className="grid min-w-[820px] items-center gap-2"
              style={{
                gridTemplateColumns:
                  "minmax(22rem,1fr) minmax(11rem,14rem) minmax(11rem,14rem) 2.25rem",
              }}
            >
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

              <Popover>
                <PopoverTrigger className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-emerald-950/10 bg-white px-3 text-sm text-zinc-800 transition hover:bg-zinc-50">
                  <span className="truncate text-left">{unitFilterLabel}</span>
                  <ChevronDown className="size-4 shrink-0 text-zinc-500" />
                </PopoverTrigger>
                <PopoverContent align="start" className="max-h-80 w-72 overflow-y-auto p-2">
                  <div className="flex items-center justify-between gap-2 border-b border-zinc-200/70 px-1 pb-2">
                    <p className="text-xs font-semibold text-zinc-600">Units</p>
                    {selectedUnits.length > 0 ? (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          setSelectedUnits([]);
                        }}
                      >
                        Clear
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-1 grid gap-1">
                    {unitOptions.map((option) => (
                      <label
                        key={option}
                        className="flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-800 hover:bg-zinc-50"
                      >
                        <Checkbox
                          checked={selectedUnits.includes(option)}
                          onCheckedChange={() => {
                            toggleUnitFilter(option);
                          }}
                        />
                        <span className="truncate">{option}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-emerald-950/10 bg-white px-3 text-sm text-zinc-800 transition hover:bg-zinc-50">
                  <span className="truncate text-left">{currencyFilterLabel}</span>
                  <ChevronDown className="size-4 shrink-0 text-zinc-500" />
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-2">
                  <div className="flex items-center justify-between gap-2 border-b border-zinc-200/70 px-1 pb-2">
                    <p className="text-xs font-semibold text-zinc-600">
                      Currency
                    </p>
                    {selectedBrackets.length > 0 ? (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          setSelectedBrackets([]);
                        }}
                      >
                        Clear
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-1 grid gap-1">
                    {CURRENCY_FILTER_OPTIONS.map((option) => (
                      <label
                        key={option}
                        className="flex min-h-8 cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-800 hover:bg-zinc-50"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Checkbox
                            checked={selectedBrackets.includes(option)}
                            onCheckedChange={() => {
                              toggleBracketFilter(option);
                            }}
                          />
                          <span className="truncate">{getBracketLabel(option)}</span>
                        </span>
                        <span className="text-xs text-zinc-500">
                          {bracketCounts[option]}
                        </span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <Button
                variant="outline"
                size="icon"
                aria-label="Clear filters"
                title="Clear filters"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedUnits([]);
                  setSelectedBrackets([]);
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
              <p className="text-xs text-zinc-600">
                Showing {filteredUsers.length} of {currencyData?.users.length ?? 0}
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[840px]">
                <TableHeader>
                  <TableRow className="border-emerald-950/8">
                    <TableHead
                      aria-sort={
                        sortKey === "name"
                          ? sortDirection === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      className="py-3 text-xs font-semibold text-emerald-900/65"
                    >
                      <button
                        type="button"
                        aria-label={getSortAriaLabel(
                          "name",
                          "name",
                          sortKey,
                          sortDirection,
                        )}
                        onClick={() => {
                          toggleSort("name");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 transition hover:bg-emerald-50 hover:text-emerald-950"
                      >
                        Name
                        <SortIcon
                          column="name"
                          activeColumn={sortKey}
                          direction={sortDirection}
                        />
                      </button>
                    </TableHead>
                    <TableHead
                      aria-sort={
                        sortKey === "unit"
                          ? sortDirection === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      className="py-3 text-xs font-semibold text-emerald-900/65"
                    >
                      <button
                        type="button"
                        aria-label={getSortAriaLabel(
                          "unit",
                          "unit",
                          sortKey,
                          sortDirection,
                        )}
                        onClick={() => {
                          toggleSort("unit");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 transition hover:bg-emerald-50 hover:text-emerald-950"
                      >
                        Unit
                        <SortIcon
                          column="unit"
                          activeColumn={sortKey}
                          direction={sortDirection}
                        />
                      </button>
                    </TableHead>
                    <TableHead
                      aria-sort={
                        sortKey === "currency"
                          ? sortDirection === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      className="py-3 text-xs font-semibold text-emerald-900/65"
                    >
                      <button
                        type="button"
                        aria-label={getSortAriaLabel(
                          "currency",
                          "currency",
                          sortKey,
                          sortDirection,
                        )}
                        onClick={() => {
                          toggleSort("currency");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 transition hover:bg-emerald-50 hover:text-emerald-950"
                      >
                        Currency
                        <SortIcon
                          column="currency"
                          activeColumn={sortKey}
                          direction={sortDirection}
                        />
                      </button>
                    </TableHead>
                    <TableHead className="py-3 text-xs font-semibold text-emerald-900/65">
                      Expires on
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && !currencyData ? (
                    <TableRow className="border-emerald-950/8">
                      <TableCell colSpan={4} className="py-12 text-center text-sm text-zinc-600">
                        Loading HA currency...
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length ? (
                    filteredUsers.map((user) => {
                      const bracket = getHaCurrencyBracket(user);
                      const validityCopy = getCurrencyValidityCopy(user);

                      return (
                        <TableRow key={user.id} className="border-emerald-950/8">
                          <TableCell className="py-3 pl-6 align-center">
                            <p className="font-medium text-zinc-950">{user.name}</p>
                          </TableCell>
                          <TableCell className="py-3 align-center text-sm text-zinc-700">
                            {user.unitName}
                          </TableCell>
                          <TableCell className="py-3 align-center">
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
                      <TableCell colSpan={4} className="py-12 text-center text-sm text-zinc-600">
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
