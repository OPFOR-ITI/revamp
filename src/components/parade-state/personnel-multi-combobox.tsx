"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { formatDesignation, type PersonnelRecord } from "@/lib/personnel";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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

export function PersonnelMultiCombobox({
  personnel,
  value,
  onChange,
  disabled = false,
}: {
  personnel: PersonnelRecord[];
  value: string[];
  onChange: (nextValue: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedSet = new Set(value);

  function handleToggle(personnelKey: string) {
    const next = new Set(selectedSet);

    if (next.has(personnelKey)) {
      next.delete(personnelKey);
    } else {
      next.add(personnelKey);
    }

    onChange(Array.from(next));
  }

  const triggerLabel =
    value.length === 0
      ? "Select servicemen"
      : value.length === 1
        ? (personnel.find((p) => p.personnelKey === value[0])?.label ??
          "1 selected")
        : `${value.length} servicemen selected`;

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
        <span className="truncate">{triggerLabel}</span>
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
          filter={(value, search) => {
            const words = search.toLowerCase().split(/\s+/).filter(Boolean);
            const lowerValue = value.toLowerCase();
            return words.every((word) => lowerValue.includes(word)) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Search rank, name, platoon, or designation..." />
          <CommandList>
            <CommandEmpty>No matching personnel found.</CommandEmpty>
            {personnel.map((person) => {
              const isSelected = selectedSet.has(person.personnelKey);

              return (
                <CommandItem
                  key={person.personnelKey}
                  value={`${person.rank} ${person.name} ${person.platoon} ${person.designation}`}
                  onSelect={() => handleToggle(person.personnelKey)}
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">
                      {person.rank} {person.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {person.platoon} / {formatDesignation(person.designation)}
                    </span>
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
