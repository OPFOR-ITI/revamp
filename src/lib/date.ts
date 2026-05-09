import { addDays, format, parseISO } from "date-fns";

import { SINGAPORE_TIME_ZONE } from "@/lib/constants";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
export const MA_TIME_WINDOW_START = "0600";
export const MA_TIME_WINDOW_END = "1900";
export const MA_TIME_MINUTE_STEP = 10;
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
    return "Active" as const;
  }

  if (endDay !== undefined && endDay < targetDay) {
    return "Past" as const;
  }

  return "Future" as const;
}

export type TemporalBucket = "Active" | "Past" | "Future";


export const TEMPORAL_BUCKET_COLORS: Record<TemporalBucket, string> = {
  Active: "bg-emerald-500",
  Past: "bg-gray-400",
  Future: "bg-pink-300",
};

export function formatDateLabel(value: string) {
  return format(parseISO(value), "ddMMyy");
}

export function formatTimestampLabel(timestamp: number) {
  return timestampFormatter.format(new Date(timestamp));
}

export function formatCompactDateLabel(value: string) {
  return format(parseISO(value), "ddMMyy");
}

export function addDaysToDateString(value: string, amount: number) {
  assertDateString(value);
  return format(addDays(parseISO(value), amount), "yyyy-MM-dd");
}

export function getDayOffsetBetweenDates(startDate: string, endDate: string) {
  return dateStringToDayIndex(endDate) - dateStringToDayIndex(startDate);
}

export function isValidTimeHHmm(value: string) {
  return /^([01]\d|2[0-3])[0-5]\d$/.test(value);
}

export function getTimeMinutesFromHHmm(value: string) {
  if (!isValidTimeHHmm(value)) {
    return null;
  }

  const hours = Number(value.slice(0, 2));
  const minutes = Number(value.slice(2, 4));

  return hours * 60 + minutes;
}

export function isValidTimeSlot({
  value,
  minTime,
  maxTime,
  minuteStep,
}: {
  value: string;
  minTime: string;
  maxTime: string;
  minuteStep: number;
}) {
  const minutes = getTimeMinutesFromHHmm(value);
  const minMinutes = getTimeMinutesFromHHmm(minTime);
  const maxMinutes = getTimeMinutesFromHHmm(maxTime);

  if (
    minutes === null ||
    minMinutes === null ||
    maxMinutes === null ||
    minuteStep <= 0
  ) {
    return false;
  }

  return (
    minMinutes <= minutes &&
    minutes <= maxMinutes &&
    (minutes - minMinutes) % minuteStep === 0
  );
}

export function isValidMaTimeSlot(value: string) {
  return isValidTimeSlot({
    value,
    minTime: MA_TIME_WINDOW_START,
    maxTime: MA_TIME_WINDOW_END,
    minuteStep: MA_TIME_MINUTE_STEP,
  });
}

export function getTimeOptions({
  minTime,
  maxTime,
  minuteStep,
}: {
  minTime: string;
  maxTime: string;
  minuteStep: number;
}) {
  const minMinutes = getTimeMinutesFromHHmm(minTime);
  const maxMinutes = getTimeMinutesFromHHmm(maxTime);

  if (minMinutes === null || maxMinutes === null || minuteStep <= 0) {
    return [];
  }

  const options: string[] = [];

  for (
    let minutes = minMinutes;
    minutes <= maxMinutes;
    minutes += minuteStep
  ) {
    const hoursPart = String(Math.floor(minutes / 60)).padStart(2, "0");
    const minutesPart = String(minutes % 60).padStart(2, "0");
    options.push(`${hoursPart}${minutesPart}`);
  }

  return options;
}

export function formatTimeHHmmLabel(value: string) {
  return isValidTimeHHmm(value) ? `${value.slice(0, 2)}:${value.slice(2, 4)}` : value;
}

export function isTimeInHHmmWindow({
  startTime,
  endTime,
  targetTime,
}: {
  startTime: string;
  endTime: string;
  targetTime: string;
}) {
  if (
    !isValidTimeHHmm(startTime) ||
    !isValidTimeHHmm(endTime) ||
    !isValidTimeHHmm(targetTime)
  ) {
    return false;
  }

  return startTime <= targetTime && targetTime <= endTime;
}

export function getCurrentSingaporeTimeHHmm(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: SINGAPORE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return formatter.format(now).replace(":", "");
}
