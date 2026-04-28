import { ConvexError, v } from "convex/values";

import {
  isEligibleForDuty,
  isHalfStepNumber,
  normalizeDutyType,
  sanitizeDutyType,
  type DutyPreset,
} from "../src/lib/duties";
import { dateStringToDayIndex, isValidDateString } from "../src/lib/date";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { ensureCurrentUser } from "./users";

const dutyPresetValidator = v.union(
  v.literal("CDO"),
  v.literal("DOO"),
  v.literal("CDS"),
  v.literal("COS"),
  v.null(),
);

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function validateDateOfDuty(value: string) {
  if (!isValidDateString(value)) {
    throw new ConvexError('Date of duty must use the format "YYYY-MM-DD".');
  }

  return dateStringToDayIndex(value);
}

function validateDutyPreset(value: DutyPreset | null, dutyType: string) {
  if (value && dutyType !== value) {
    throw new ConvexError("Preset duties must use their fixed duty label.");
  }
}

function validatePoints(points: number, isExtra: boolean) {
  if (isExtra) {
    return 0;
  }

  if (!Number.isFinite(points)) {
    throw new ConvexError("Points must be a valid number.");
  }

  if (points < 0) {
    throw new ConvexError("Points must be 0 or greater.");
  }

  if (!isHalfStepNumber(points)) {
    throw new ConvexError("Points must use 0.5 increments.");
  }

  return points;
}

function normalizeDutyInput({
  dutyPreset,
  dutyType,
  rank,
  designation,
}: {
  dutyPreset: DutyPreset | null;
  dutyType: string;
  rank: string;
  designation: string;
}) {
  const normalizedDutyType = sanitizeDutyType(dutyType);

  if (!normalizedDutyType) {
    throw new ConvexError("Duty type is required.");
  }

  validateDutyPreset(dutyPreset, normalizedDutyType);

  if (
    !isEligibleForDuty({
      dutyPreset,
      rank,
      designation,
    })
  ) {
    throw new ConvexError("The selected serviceman is not eligible for this duty.");
  }

  return {
    dutyType: normalizedDutyType,
    dutyTypeNormalized: normalizeDutyType(normalizedDutyType),
  };
}

async function ensureNoDuplicateAssignment(
  ctx: MutationCtx,
  {
    dateOfDuty,
    personnelKey,
    dutyTypeNormalized,
    ignoreAssignmentId,
  }: {
    dateOfDuty: string;
    personnelKey: string;
    dutyTypeNormalized: string;
    ignoreAssignmentId?: Id<"dutyAssignments">;
  },
) {
  const existingAssignments = await ctx.db
    .query("dutyAssignments")
    .withIndex(
      "by_dateOfDuty_and_personnelKey_and_dutyTypeNormalized",
      (q) =>
        q
          .eq("dateOfDuty", dateOfDuty)
          .eq("personnelKey", personnelKey)
          .eq("dutyTypeNormalized", dutyTypeNormalized),
    )
    .collect();

  const duplicate = existingAssignments.find(
    (assignment) => assignment._id !== ignoreAssignmentId,
  );

  if (duplicate) {
    throw new ConvexError(
      "This serviceman already has the same duty assigned on that date.",
    );
  }
}

function sortAssignments<
  T extends {
    dutyDay: number;
    dutyType: string;
    rank: string;
    name: string;
  },
>(left: T, right: T) {
  return (
    left.dutyDay - right.dutyDay ||
    left.dutyType.localeCompare(right.dutyType) ||
    left.rank.localeCompare(right.rank) ||
    left.name.localeCompare(right.name)
  );
}

export const listAssignmentsForRange = query({
  args: {
    fromDate: v.string(),
    toDate: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureCurrentUser(ctx, { requireApproved: true });

    const fromDay = validateDateOfDuty(args.fromDate);
    const toDay = validateDateOfDuty(args.toDate);

    if (toDay < fromDay) {
      throw new ConvexError("The selected date range is invalid.");
    }

    const assignments = await ctx.db
      .query("dutyAssignments")
      .withIndex("by_dutyDay", (q) => q.gte("dutyDay", fromDay).lte("dutyDay", toDay))
      .collect();

    return assignments.sort(sortAssignments);
  },
});

export const createAssignment = mutation({
  args: {
    personnelKey: v.string(),
    rank: v.string(),
    name: v.string(),
    platoon: v.string(),
    designation: v.string(),
    dutyType: v.string(),
    dutyPreset: dutyPresetValidator,
    dateOfDuty: v.string(),
    points: v.number(),
    isExtra: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { appUser, authUser } = await ensureCurrentUser(ctx, {
      requireApproved: true,
    });
    const now = Date.now();
    const dutyDay = validateDateOfDuty(args.dateOfDuty);
    const personnelKey = normalizeText(args.personnelKey);
    const rank = normalizeText(args.rank);
    const name = normalizeText(args.name);
    const platoon = normalizeText(args.platoon);
    const designation = normalizeText(args.designation);
    const { dutyType, dutyTypeNormalized } = normalizeDutyInput({
      dutyPreset: args.dutyPreset,
      dutyType: args.dutyType,
      rank,
      designation,
    });
    const points = validatePoints(args.points, args.isExtra);

    await ensureNoDuplicateAssignment(ctx, {
      dateOfDuty: args.dateOfDuty,
      personnelKey,
      dutyTypeNormalized,
    });

    return await ctx.db.insert("dutyAssignments", {
      personnelKey,
      rank,
      name,
      platoon,
      designation,
      dutyType,
      dutyTypeNormalized,
      dutyPreset: args.dutyPreset,
      dateOfDuty: args.dateOfDuty,
      dutyDay,
      points,
      isExtra: args.isExtra,
      createdByName: authUser.name?.trim() || appUser.name,
      createdByEmail: authUser.email,
      createdByAuthUserId: appUser.authUserId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateAssignment = mutation({
  args: {
    assignmentId: v.id("dutyAssignments"),
    personnelKey: v.string(),
    rank: v.string(),
    name: v.string(),
    platoon: v.string(),
    designation: v.string(),
    dutyType: v.string(),
    dutyPreset: dutyPresetValidator,
    dateOfDuty: v.string(),
    points: v.number(),
    isExtra: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ensureCurrentUser(ctx, { requireApproved: true });

    const existing = await ctx.db.get(args.assignmentId);

    if (!existing) {
      throw new ConvexError("The selected duty assignment no longer exists.");
    }

    const dutyDay = validateDateOfDuty(args.dateOfDuty);
    const personnelKey = normalizeText(args.personnelKey);
    const rank = normalizeText(args.rank);
    const name = normalizeText(args.name);
    const platoon = normalizeText(args.platoon);
    const designation = normalizeText(args.designation);
    const { dutyType, dutyTypeNormalized } = normalizeDutyInput({
      dutyPreset: args.dutyPreset,
      dutyType: args.dutyType,
      rank,
      designation,
    });
    const points = validatePoints(args.points, args.isExtra);

    await ensureNoDuplicateAssignment(ctx, {
      dateOfDuty: args.dateOfDuty,
      personnelKey,
      dutyTypeNormalized,
      ignoreAssignmentId: existing._id,
    });

    await ctx.db.patch(args.assignmentId, {
      personnelKey,
      rank,
      name,
      platoon,
      designation,
      dutyType,
      dutyTypeNormalized,
      dutyPreset: args.dutyPreset,
      dateOfDuty: args.dateOfDuty,
      dutyDay,
      points,
      isExtra: args.isExtra,
      updatedAt: Date.now(),
    });
  },
});

export const deleteAssignment = mutation({
  args: {
    assignmentId: v.id("dutyAssignments"),
  },
  handler: async (ctx, args) => {
    await ensureCurrentUser(ctx, { requireApproved: true });

    const existing = await ctx.db.get(args.assignmentId);

    if (!existing) {
      return null;
    }

    await ctx.db.delete(args.assignmentId);

    return { deleted: true };
  },
});
