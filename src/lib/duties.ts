import { getDay, parseISO } from "date-fns";
import { z } from "zod";

import { assertDateString } from "@/lib/date";

export const DUTY_PRESETS = ["DOO", "CDS", "COS"] as const;
export const DUTY_KIND_VALUES = [...DUTY_PRESETS, "CUSTOM"] as const;
export const MAX_DUTY_TYPE_LENGTH = 100;

export type DutyPreset = (typeof DUTY_PRESETS)[number];
export type DutyKind = (typeof DUTY_KIND_VALUES)[number];

export const DUTY_COLOR_CLASSES: Record<DutyPreset | "CUSTOM", string> = {
  DOO: "border-sky-300 bg-sky-50 text-sky-950",
  CDS: "border-amber-300 bg-amber-50 text-amber-950",
  COS: "border-emerald-300 bg-emerald-50 text-emerald-950",
  CUSTOM: "border-zinc-300 bg-zinc-100 text-zinc-900",
};

function normalizeComparableValue(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export function sanitizeDutyType(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeDutyType(value: string) {
  return sanitizeDutyType(value).toLowerCase();
}

export function getDutyPresetFromKind(value: DutyKind): DutyPreset | null {
  return value === "CUSTOM" ? null : value;
}

export function getDutyKindFromPreset(value: DutyPreset | null): DutyKind {
  return value ?? "CUSTOM";
}

export function getDefaultDutyPoints(dateOfDuty: string) {
  assertDateString(dateOfDuty);

  const day = getDay(parseISO(dateOfDuty));

  if (day === 6) {
    return 2;
  }

  if (day === 5 || day === 0) {
    return 1.5;
  }

  return 1;
}

export function isHalfStepNumber(value: number) {
  if (!Number.isFinite(value)) {
    return false;
  }

  return Math.abs(value * 2 - Math.round(value * 2)) < 1e-9;
}

export function isEligibleForDuty({
  dutyPreset,
  rank,
  designation,
}: {
  dutyPreset: DutyPreset | null;
  rank: string;
  designation: string;
}) {
  if (!dutyPreset) {
    return true;
  }

  const normalizedRank = normalizeComparableValue(rank);
  const normalizedDesignation = normalizeComparableValue(designation);

  switch (dutyPreset) {
    case "DOO":
      return normalizedDesignation === "PC";
    case "CDS":
      return normalizedDesignation === "PS";
    case "COS":
      return (
        normalizedDesignation === "SC" ||
        normalizedRank === "CFC" ||
        normalizedRank === "CPL"
      );
  }
}

export function getDutyEligibilityDescription(dutyPreset: DutyPreset | null) {
  switch (dutyPreset) {
    case "DOO":
      return "Only personnel with PC designation can be assigned.";
    case "CDS":
      return "Only personnel with PS designation can be assigned.";
    case "COS":
      return "Requires SC designation or rank CFC/CPL.";
    default:
      return "Custom duties can be assigned to any personnel.";
  }
}

export function getDutyColorKey(dutyPreset: DutyPreset | null) {
  return dutyPreset ?? "CUSTOM";
}

export function createExactDutyDuplicateKey(
  dateOfDuty: string,
  personnelKey: string,
  dutyTypeNormalized: string,
) {
  return [dateOfDuty, personnelKey.trim(), dutyTypeNormalized.trim()].join("|");
}

export const dutyAssignmentFormSchema = z
  .object({
    dutyKind: z.enum(DUTY_KIND_VALUES),
    customDutyType: z
      .string()
      .max(
        MAX_DUTY_TYPE_LENGTH,
        `Duty type must be ${MAX_DUTY_TYPE_LENGTH} characters or fewer.`,
      )
      .optional(),
    personnelKey: z.string().min(1, "Select a serviceman."),
    dateOfDuty: z.string().min(1, "Date of duty is required."),
    points: z.number().finite("Points are required."),
    isExtra: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.dutyKind === "CUSTOM" && !sanitizeDutyType(values.customDutyType ?? "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customDutyType"],
        message: "Enter a custom duty name.",
      });
    }

    try {
      assertDateString(values.dateOfDuty);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateOfDuty"],
        message: "Select a valid duty date.",
      });
    }

    if (values.isExtra) {
      return;
    }

    if (!Number.isFinite(values.points)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["points"],
        message: "Points are required.",
      });
      return;
    }

    if (values.points < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["points"],
        message: "Points must be 0 or greater.",
      });
    }

    if (!isHalfStepNumber(values.points)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["points"],
        message: "Points must use 0.5 increments.",
      });
    }
  });

export type DutyAssignmentFormValues = z.infer<typeof dutyAssignmentFormSchema>;
