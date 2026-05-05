"use client";

import { X } from "lucide-react";

import { type PersonnelRecord } from "@/lib/personnel";
import { cn } from "@/lib/utils";

export function BulkSelectionList({
  personnel,
  selectedKeys,
  onRemove,
  className,
}: {
  personnel: PersonnelRecord[];
  selectedKeys: string[];
  onRemove?: (personnelKey: string) => void;
  className?: string;
}) {
  const selectedPersonnel = selectedKeys
    .map((key) => personnel.find((p) => p.personnelKey === key))
    .filter((p): p is PersonnelRecord => p !== undefined);

  if (selectedPersonnel.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex max-h-32 flex-wrap content-start gap-1.5 overflow-y-auto rounded-xl pr-1",
        className,
      )}
    >
      {selectedPersonnel.map((person) => (
        <div
          key={person.personnelKey}
          className="flex max-w-full items-center gap-1 rounded-full border border-emerald-950/10 bg-emerald-950/[0.05] py-1 pl-2 pr-1 text-[10px] leading-none text-zinc-700"
        >
          <span className="min-w-0 truncate whitespace-nowrap">
            {person.rank} {person.name} / {person.platoon}
          </span>
          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(person.personnelKey)}
              className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-950/8 text-zinc-500 transition-colors hover:bg-emerald-950/12 hover:text-zinc-800"
              aria-label={`Remove ${person.rank} ${person.name}`}
            >
              <X className="size-2.5" />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
