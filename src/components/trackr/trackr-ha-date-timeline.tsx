"use client";

import { useRef, useState, type MouseEvent } from "react";
import { Check, Hourglass, X } from "lucide-react";

import { SINGAPORE_TIME_ZONE } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type TrackrHaDateTimelineStatus =
  | "completed"
  | "missed"
  | "pending"
  | "unknown";

export type TrackrHaDateTimelineItem = {
  id: string | number;
  date: Date;
  isToday?: boolean;
  markerLabel?: string;
  status: TrackrHaDateTimelineStatus;
  title?: string;
};

const timelineDateFormatter = new Intl.DateTimeFormat("en-SG", {
  timeZone: SINGAPORE_TIME_ZONE,
  month: "short",
  day: "numeric",
});

const timelineWeekdayFormatter = new Intl.DateTimeFormat("en-SG", {
  timeZone: SINGAPORE_TIME_ZONE,
  weekday: "short",
});

export function TrackrHaDateTimeline({
  className,
  items,
  minColumnWidth = 72,
}: {
  className?: string;
  items: TrackrHaDateTimelineItem[];
  minColumnWidth?: number;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const dragStartXRef = useRef(0);
  const dragStartScrollLeftRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  function handleMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (!scrollerRef.current) {
      return;
    }

    setIsDragging(true);
    dragStartXRef.current = event.pageX;
    dragStartScrollLeftRef.current = scrollerRef.current.scrollLeft;
  }

  function handleMouseMove(event: MouseEvent<HTMLDivElement>) {
    if (!isDragging || !scrollerRef.current) {
      return;
    }

    event.preventDefault();
    scrollerRef.current.scrollLeft =
      dragStartScrollLeftRef.current - (event.pageX - dragStartXRef.current);
  }

  function stopDragging() {
    setIsDragging(false);
  }

  return (
    <div
      ref={scrollerRef}
      onMouseDown={handleMouseDown}
      onMouseLeave={stopDragging}
      onMouseMove={handleMouseMove}
      onMouseUp={stopDragging}
      className={cn(
        "scrollbar-hidden max-w-full min-w-0 touch-pan-x overflow-x-auto overscroll-x-contain pb-1 select-none",
        isDragging ? "cursor-grabbing" : "cursor-grab",
        className,
      )}
    >
      <div
        className="grid max-w-none shrink-0"
        style={{
          gridTemplateColumns: `repeat(${items.length}, minmax(${minColumnWidth}px, 1fr))`,
          width: `max(100%, ${items.length * minColumnWidth}px)`,
        }}
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <div key={item.id} className="relative flex flex-col items-center">
              <div className="text-center text-xs leading-4 text-zinc-500">
                <p>{timelineDateFormatter.format(item.date)}</p>
                <p>{timelineWeekdayFormatter.format(item.date)}</p>
              </div>
              <div className="relative mt-2 flex w-full justify-center">
                {!isLast ? (
                  <div
                    className={cn(
                      "absolute top-1/2 left-1/2 h-px w-full -translate-y-1/2",
                      item.status === "pending" || item.status === "unknown"
                        ? "border-t border-dotted border-zinc-300"
                        : "bg-teal-600",
                    )}
                  />
                ) : null}
                <div
                  className={cn(
                    "relative z-10 flex size-9 items-center justify-center rounded-full border-2 bg-white",
                    item.status === "completed" &&
                      "border-teal-600 bg-teal-600 text-white",
                    item.status === "missed" && "border-teal-600 text-teal-700",
                    item.status === "pending" && "border-zinc-300 text-zinc-400",
                    item.status === "unknown" &&
                      "border-zinc-300 bg-zinc-50 text-zinc-400",
                  )}
                  title={item.title}
                >
                  {item.markerLabel ? (
                    <span className="text-sm font-semibold">{item.markerLabel}</span>
                  ) : item.status === "completed" ? (
                    <Check className="size-4" />
                  ) : item.status === "pending" || item.status === "unknown" ? (
                    <Hourglass className="size-4" />
                  ) : (
                    <X className="size-4" />
                  )}
                </div>
              </div>
              {item.isToday ? (
                <p className="mt-1 text-xs text-zinc-500">Today</p>
              ) : (
                <p className="mt-1 h-4 text-xs text-transparent">.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
