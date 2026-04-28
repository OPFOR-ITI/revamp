import { format, parseISO } from "date-fns";

import { SINGAPORE_TIME_ZONE } from "@/lib/constants";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SINGAPORE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const timestampFormatter = new Intl.DateTimeFormat("en-SG", {
  timeZone: SINGAPORE_TIME_ZONE,
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function isValidDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function assertDateString(value: string) {
  if (!isValidDateString(value)) {
    throw new Error(`Invalid date string "${value}". Expected YYYY-MM-DD.`);
  }
}

export function dateStringToDayIndex(value: string) {
  assertDateString(value);
  const [year, month, day] = value.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_IN_MS);
}

export function getTodaySingaporeDateString(now = new Date()) {
  return dateFormatter.format(now);
}

export function getTodaySingaporeDayIndex(now = new Date()) {
  return dateStringToDayIndex(getTodaySingaporeDateString(now));
}

export function isActiveOnDayRange(
  startDay: number,
  endDay: number | undefined,
  targetDay: number,
) {
  return startDay <= targetDay && (endDay === undefined || targetDay <= endDay);
}

export function getTemporalBucketForDayRange(
  startDay: number,
  endDay: number | undefined,
  targetDay: number,
) {
  if (isActiveOnDayRange(startDay, endDay, targetDay)) {
    return "active" as const;
  }

  if (endDay !== undefined && endDay < targetDay) {
    return "past" as const;
  }

  return "future" as const;
}

export function formatDateLabel(value: string) {
  return format(parseISO(value), "dd MMM yyyy");
}

export function formatTimestampLabel(timestamp: number) {
  return timestampFormatter.format(new Date(timestamp));
}
