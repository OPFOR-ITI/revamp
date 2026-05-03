"use client";

import { useState } from "react";
import { ClipboardCopy, Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { ConductListItem } from "@/components/conducts/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { copyTextToClipboard } from "@/lib/clipboard";
import {
  formatConductWhatsappMessage,
  type ConductWhatsappNameListMode,
} from "@/lib/conduct-whatsapp";
import { formatDateLabel } from "@/lib/date";

function getTabLabel(mode: ConductWhatsappNameListMode) {
  switch (mode) {
    case "non-participating":
      return "Non-Participating";
    case "participating":
      return "Participating";
    case "both":
      return "Both";
  }
}

export function ConductWhatsappPreviewDialog({
  open,
  onOpenChange,
  conduct,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conduct: ConductListItem | null;
}) {
  const [nameListMode, setNameListMode] =
    useState<ConductWhatsappNameListMode>("non-participating");
  const [isCopying, setIsCopying] = useState(false);

  const whatsappData = conduct?.whatsappData ?? null;
  const previewText = whatsappData
    ? formatConductWhatsappMessage(whatsappData, { nameListMode })
    : "";
  const postedTotal =
    whatsappData?.sections.reduce(
      (total, section) => total + section.postedStrength,
      0,
    ) ?? 0;
  const participatingTotal =
    whatsappData?.sections.reduce(
      (total, section) => total + section.participatingStrength,
      0,
    ) ?? 0;
  const nonParticipatingTotal =
    whatsappData?.sections.reduce(
      (total, section) => total + section.nonParticipatingStrength,
      0,
    ) ?? 0;

  async function handleCopy() {
    if (!previewText) {
      return;
    }

    setIsCopying(true);

    try {
      await copyTextToClipboard(previewText);
      toast.success(`Conduct WhatsApp message copied with ${getTabLabel(nameListMode).toLowerCase()} names.`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to copy the conduct WhatsApp message.",
      );
    } finally {
      setIsCopying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-1rem)] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {conduct ? `${conduct.name} WhatsApp Preview` : "WhatsApp Preview"}
          </DialogTitle>
          <DialogDescription>
            Preview the exact conduct-state text before copying it into WhatsApp.
          </DialogDescription>
        </DialogHeader>

        {!whatsappData ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            Attendance has not been initialized yet, so the WhatsApp preview is unavailable.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-emerald-950/10 bg-emerald-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-900/55">
                  Participating
                </p>
                <p className="mt-1 text-2xl font-semibold text-emerald-900">
                  {participatingTotal.toString().padStart(2, "0")}
                </p>
              </div>
              <div className="rounded-2xl border border-rose-950/10 bg-rose-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-rose-900/55">
                  Non-Participating
                </p>
                <p className="mt-1 text-2xl font-semibold text-rose-900">
                  {nonParticipatingTotal.toString().padStart(2, "0")}
                </p>
              </div>
            </div>

            <div className="rounded-[24px] border border-emerald-950/10 bg-white/80 p-4 shadow-sm shadow-emerald-950/5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-950">
                    Included name list
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleCopy()}
                  disabled={!previewText || isCopying}
                  className="w-full lg:ml-auto lg:w-auto"
                >
                  {isCopying ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ClipboardCopy className="size-4" />
                  )}
                  Copy WhatsApp
                </Button>
              </div>

              <div className="mt-3">
                <Tabs
                  value={nameListMode}
                  onValueChange={(value) =>
                    setNameListMode(value as ConductWhatsappNameListMode)
                  }
                  className="w-full"
                >
                  <TabsList className="w-full">
                    <TabsTrigger value="non-participating">
                      Non-Participating
                    </TabsTrigger>
                    <TabsTrigger value="participating">Participating</TabsTrigger>
                    <TabsTrigger value="both">Both</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            <div className="rounded-[26px] border border-emerald-950/10 bg-emerald-950/[0.03] p-4">
              <pre className="overflow-x-auto whitespace-pre-wrap text-sm leading-6 text-zinc-900">
                {previewText}
              </pre>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
