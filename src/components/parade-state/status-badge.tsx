import { formatStatusLabel, type Status } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const MAX_STATUS_BADGE_LENGTH = 25;

const statusBadgeClasses: Record<Status, string> = {
  MC: "bg-rose-100 text-rose-900 ring-1 ring-rose-200",
  RIB: "bg-blue-100 text-blue-950 ring-1 ring-blue-200",
  AWOL: "bg-red-200 text-red-950 ring-1 ring-red-300",
  DB: "bg-red-100 text-red-900 ring-1 ring-red-200",
  OFF: "bg-indigo-100 text-indigo-950 ring-1 ring-indigo-200",
  LEAVE: "bg-cyan-100 text-cyan-950 ring-1 ring-cyan-200",
  RSO: "bg-fuchsia-100 text-fuchsia-950 ring-1 ring-fuchsia-200",
  MA: "bg-pink-100 text-pink-950 ring-1 ring-pink-200",
  "SEND OUT": "bg-blue-100 text-blue-950 ring-1 ring-blue-200",
  "BOOKED OUT": "bg-blue-100 text-blue-950 ring-1 ring-blue-200",
  "STAY OUT": "bg-blue-100 text-blue-950 ring-1 ring-blue-200",
  HOSPITALISED: "bg-rose-50 text-rose-950 ring-1 ring-rose-200",
  LD: "bg-amber-100 text-amber-950 ring-1 ring-amber-200",
  "EX RMJ": "bg-slate-200 text-slate-900 ring-1 ring-slate-300",
  "EX STAY IN": "bg-sky-100 text-sky-950 ring-1 ring-sky-200",
  "EX CAMO": "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200",
  "EX FLEGS": "bg-orange-100 text-orange-950 ring-1 ring-orange-200",
  "EX HEAVY LOAD": "bg-orange-100 text-orange-950 ring-1 ring-orange-200",
  "EX SQUATTING": "bg-orange-100 text-orange-950 ring-1 ring-orange-200",
  "EX EXPLOSIVES & PYROTECHNICS": "bg-stone-100 text-stone-950 ring-1 ring-stone-200",
  "EX DUST": "bg-yellow-100 text-yellow-950 ring-1 ring-yellow-200",
  "EX DRIVING": "bg-slate-200 text-slate-900 ring-1 ring-slate-300",
  "EX PUSHUPS": "bg-slate-200 text-slate-900 ring-1 ring-slate-300",
  "EX UPPER LIMB": "bg-slate-200 text-slate-900 ring-1 ring-slate-300",
  "EX PULL UP": "bg-slate-200 text-slate-900 ring-1 ring-slate-300",
  "EX CHIN UP": "bg-slate-200 text-slate-900 ring-1 ring-slate-300",
  "EX HELMET": "bg-slate-200 text-slate-900 ring-1 ring-slate-300",
  "EX LOUD NOISE ENVIRONMENT": "bg-slate-200 text-slate-900 ring-1 ring-slate-300",
  "EX LOUD NOISE VOCATION": "bg-slate-200 text-slate-900 ring-1 ring-slate-300",
  "EX OVERSEAS DEPLOYEMENT": "bg-slate-200 text-slate-900 ring-1 ring-slate-300",
  "JAIL": "bg-slate-200 text-slate-900 ring-1 ring-slate-300",
  Others: "bg-violet-100 text-violet-950 ring-1 ring-violet-200",
};

export function StatusBadge({
  status,
  customStatus,
}: {
  status: Status;
  customStatus?: string;
}) {
  const label = formatStatusLabel(status, customStatus);
  const isTruncated = label.length > MAX_STATUS_BADGE_LENGTH;
  const displayLabel = isTruncated
    ? `${label.slice(0, MAX_STATUS_BADGE_LENGTH - 1).trimEnd()}…`
    : label;

  const badge = (
    <Badge
      className={cn("border-transparent font-semibold text-[10px] py-0 tracking-wide", statusBadgeClasses[status])}
      variant="outline"
    >
      {displayLabel}
    </Badge>
  );

  if (!isTruncated) {
    return badge;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="cursor-default" />}>
        {badge}
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}
