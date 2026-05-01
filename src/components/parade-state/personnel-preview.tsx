import { formatDesignation, type PersonnelRecord } from "@/lib/personnel";

export function PersonnelPreview({
  personnel,
}: {
  personnel?: PersonnelRecord;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl border border-emerald-950/10 bg-emerald-950/[0.03] px-3 py-2.5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-900/55">
          Rank
        </p>
        <p className="text-sm font-medium text-zinc-900">
          {personnel?.rank ?? "--"}
        </p>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-900/55">
          Name
        </p>
        <p className="text-sm font-medium text-zinc-900">
          {personnel?.name ?? "--"}
        </p>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-900/55">
          Platoon
        </p>
        <p className="text-sm font-medium text-zinc-900">
          {personnel?.platoon ?? "--"}
        </p>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-900/55">
          Designation
        </p>
        <p className="text-sm font-medium text-zinc-900">
          {personnel ? formatDesignation(personnel.designation) : "--"}
        </p>
      </div>
    </div>
  );
}
