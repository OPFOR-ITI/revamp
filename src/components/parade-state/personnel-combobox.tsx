"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { formatDesignation, type PersonnelRecord } from "@/lib/personnel";
import { cn } from "@/lib/utils";
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

export function PersonnelCombobox({
  personnel,
  value,
  onChange,
  disabled = false,
}: {
  personnel: PersonnelRecord[];
  value?: string;
  onChange: (nextValue: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedPersonnel = personnel.find(
    (person) => person.personnelKey === value,
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-10 w-full justify-between px-3 text-left font-normal",
          !selectedPersonnel && "text-muted-foreground",
        )}
        disabled={disabled}
      >
        <span className="truncate">
          {selectedPersonnel ? selectedPersonnel.label : "Select serviceman"}
        </span>
        <ChevronsUpDown className="size-4 opacity-50" />
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
              const isSelected = person.personnelKey === value;

              return (
                <CommandItem
                  key={person.personnelKey}
                  value={`${person.rank} ${person.name} ${person.platoon} ${person.designation}`}
                  onSelect={() => {
                    onChange(person.personnelKey);
                    setOpen(false);
                  }}
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
