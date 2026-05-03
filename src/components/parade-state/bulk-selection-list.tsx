"use client";

import { X } from "lucide-react";

import { formatDesignation, type PersonnelRecord } from "@/lib/personnel";
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
    <div className={cn("flex flex-col gap-1.5", className)}>
      {selectedPersonnel.map((person) => (
        <div
          key={person.personnelKey}
          className="group flex items-center gap-2 rounded-lg border border-emerald-950/10 bg-emerald-950/[0.03] px-3 py-2 text-sm text-zinc-700"
        >
          <span className="min-w-0 flex-1 truncate">
            {person.rank} {person.name} / {person.platoon} /{" "}
            {formatDesignation(person.designation)}
          </span>
          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(person.personnelKey)}
              className="shrink-0 rounded-md p-0.5 text-zinc-400 opacity-0 transition-opacity hover:text-zinc-700 group-hover:opacity-100"
              aria-label={`Remove ${person.rank} ${person.name}`}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
