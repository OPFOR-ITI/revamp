"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
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
import { cn } from "@/lib/utils";

type BasePersonnelOption = {
  personnelKey: string;
  rank: string;
  name: string;
  platoon: string;
};

export function PersonnelMultiCombobox<T extends BasePersonnelOption>({
  personnel,
  availablePersonnel,
  value,
  onChange,
  disabled = false,
  emptySelectionLabel,
  getSingleSelectionLabel,
  getMultiSelectionLabel,
  searchPlaceholder,
  getSearchText,
  getSecondaryText,
  emptyResultsLabel = "No matching personnel found.",
  scopeSummaryLabel,
  selectAllLabel = "Select all",
  deselectAllLabel = "Deselect all",
  enablePlatoonFilter = false,
  platoonFilterLabel = "Platoon",
  allPlatoonsLabel = "All platoons",
}: {
  personnel: T[];
  availablePersonnel?: T[];
  value: string[];
  onChange: (nextValue: string[]) => void;
  disabled?: boolean;
  emptySelectionLabel: string;
  getSingleSelectionLabel: (person: T) => string;
  getMultiSelectionLabel: (count: number) => string;
  searchPlaceholder: string;
  getSearchText: (person: T) => string;
  getSecondaryText?: (person: T) => string | undefined;
  emptyResultsLabel?: string;
  scopeSummaryLabel?: (selectedInScopeCount: number, scopeCount: number) => string;
  selectAllLabel?: string;
  deselectAllLabel?: string;
  enablePlatoonFilter?: boolean;
  platoonFilterLabel?: string;
  allPlatoonsLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selectedPlatoon, setSelectedPlatoon] = useState("all");
  const selectedSet = new Set(value);
  const selectablePersonnel = availablePersonnel ?? personnel;
  const platoonOptions = Array.from(
    new Set(selectablePersonnel.map((person) => person.platoon)),
  ).sort((left, right) => left.localeCompare(right));
  const shouldShowPlatoonFilter = enablePlatoonFilter && platoonOptions.length > 1;
  const activePlatoon =
    shouldShowPlatoonFilter &&
    selectedPlatoon !== "all" &&
    platoonOptions.includes(selectedPlatoon)
      ? selectedPlatoon
      : "all";
  const visiblePersonnel =
    shouldShowPlatoonFilter && activePlatoon !== "all"
      ? selectablePersonnel.filter((person) => person.platoon === activePlatoon)
      : selectablePersonnel;
  const visibleKeySet = new Set(
    visiblePersonnel.map((person) => person.personnelKey),
  );
  const selectedInScopeCount = value.filter((key) =>
    visibleKeySet.has(key),
  ).length;
  const hasSelectablePersonnel = visiblePersonnel.length > 0;
  const hasSelectedInScope = selectedInScopeCount > 0;
  const areAllSelectablePersonnelSelected =
    hasSelectablePersonnel &&
    selectedInScopeCount === visiblePersonnel.length;

  function handleToggle(personnelKey: string) {
    const next = new Set(selectedSet);

    if (next.has(personnelKey)) {
      next.delete(personnelKey);
    } else {
      next.add(personnelKey);
    }

    onChange(Array.from(next));
  }

  function handleSelectAllShown() {
    const next = new Set(selectedSet);

    for (const person of visiblePersonnel) {
      next.add(person.personnelKey);
    }

    onChange(
      personnel
        .filter((person) => next.has(person.personnelKey))
        .map((person) => person.personnelKey),
    );
  }

  function handleDeselectShown() {
    onChange(value.filter((key) => !visibleKeySet.has(key)));
  }

  const selectedPerson =
    value.length === 1
      ? personnel.find((person) => person.personnelKey === value[0])
      : undefined;
  const resolvedTriggerLabel =
    value.length === 0
      ? emptySelectionLabel
      : value.length === 1
      ? selectedPerson
        ? getSingleSelectionLabel(selectedPerson)
        : "1 selected"
      : getMultiSelectionLabel(value.length);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-10 w-full justify-between px-3 text-left font-normal",
          value.length === 0 && "text-muted-foreground",
        )}
        disabled={disabled}
      >
        <span className="truncate">{resolvedTriggerLabel}</span>
        <div className="flex items-center gap-1.5">
          {value.length > 0 ? (
            <Badge
              variant="secondary"
              className="h-5 rounded-md px-1.5 text-xs font-medium"
            >
              {value.length}
            </Badge>
          ) : null}
          <ChevronsUpDown className="size-4 opacity-50" />
        </div>
      </PopoverTrigger>

      <PopoverContent className="w-[min(32rem,calc(100vw-2rem))] p-0">
        <Command
          filter={(entryValue, search) => {
            const words = search.toLowerCase().split(/\s+/).filter(Boolean);
            const lowerValue = entryValue.toLowerCase();
            return words.every((word) => lowerValue.includes(word)) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={searchPlaceholder} />
          {shouldShowPlatoonFilter ? (
            <div className="border-b border-border/60 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-muted-foreground">
                  {platoonFilterLabel}
                </span>
                <Select
                  value={activePlatoon}
                  onValueChange={(value) => setSelectedPlatoon(value ?? "all")}
                >
                  <SelectTrigger className="h-8 w-[180px] text-xs">
                    <SelectValue placeholder="Select platoon" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{allPlatoonsLabel}</SelectItem>
                    {platoonOptions.map((platoon) => (
                      <SelectItem key={platoon} value={platoon}>
                        {platoon}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              {scopeSummaryLabel
                ? scopeSummaryLabel(selectedInScopeCount, visiblePersonnel.length)
                : `${selectedInScopeCount}/${visiblePersonnel.length} selected in this scope`}
            </p>
            <div className="flex gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleSelectAllShown}
                disabled={!hasSelectablePersonnel || areAllSelectablePersonnelSelected}
              >
                {selectAllLabel}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleDeselectShown}
                disabled={!hasSelectedInScope}
              >
                {deselectAllLabel}
              </Button>
            </div>
          </div>
          <CommandList>
            <CommandEmpty>{emptyResultsLabel}</CommandEmpty>
            {visiblePersonnel.map((person) => {
              const isSelected = selectedSet.has(person.personnelKey);
              const secondaryText = getSecondaryText?.(person);

              return (
                <CommandItem
                  key={person.personnelKey}
                  value={getSearchText(person)}
                  onSelect={() => handleToggle(person.personnelKey)}
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">
                      {person.rank} {person.name}
                    </span>
                    {secondaryText ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {secondaryText}
                      </span>
                    ) : null}
                  </div>
                  <Check
                    className={cn(
                      "ml-auto size-4 text-emerald-700",
                      isSelected ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
