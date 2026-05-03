"use client";

import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { ParadeReportBuilder } from "@/components/parade-state/parade-report-builder";

export function ParadeReportModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-1rem)] overflow-y-auto sm:max-w-5xl">
        {open ? <ParadeReportBuilder autoCopyOnReady /> : null}
      </DialogContent>
    </Dialog>
  );
}
