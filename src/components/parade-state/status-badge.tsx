import { formatStatusLabel, type Status } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusBadgeClasses: Record<Status, string> = {
  MC: "bg-rose-100 text-rose-900 ring-1 ring-rose-200",
  LD: "bg-amber-100 text-amber-950 ring-1 ring-amber-200",
  "EX RMJ": "bg-slate-200 text-slate-900 ring-1 ring-slate-300",
  "EX STAY IN": "bg-sky-100 text-sky-950 ring-1 ring-sky-200",
  "EX CAMO": "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200",
  "EX FLEGS": "bg-orange-100 text-orange-950 ring-1 ring-orange-200",
  "EX HEAVY LOAD": "bg-orange-100 text-orange-950 ring-1 ring-orange-200",
  "EX SQUATTING": "bg-orange-100 text-orange-950 ring-1 ring-orange-200",
  Others: "bg-violet-100 text-violet-950 ring-1 ring-violet-200",
};

export function StatusBadge({
  status,
  customStatus,
}: {
  status: Status;
  customStatus?: string;
}) {
  return (
    <Badge
      className={cn("border-transparent font-semibold tracking-wide", statusBadgeClasses[status])}
      variant="outline"
    >
      {formatStatusLabel(status, customStatus)}
    </Badge>
  );
}
