import { ConvexError, v } from "convex/values";

import {
  MAX_REMARKS_LENGTH,
  doesStatusAffectParadeState,
  type Status,
} from "../src/lib/constants";
import {
  dateStringToDayIndex,
  getTodaySingaporeDayIndex,
} from "../src/lib/date";
import { mutation, query } from "./_generated/server";
import { ensureCurrentUser } from "./users";

const statusValidator = v.union(
  v.literal("MC"),
  v.literal("LD"),
  v.literal("EX RMJ"),
  v.literal("EX STAY IN"),
  v.literal("EX CAMO"),
  v.literal("EX FLEGS"),
  v.literal("EX HEAVY LOAD"),
  v.literal("EX SQUATTING"),
);

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeRemarks(value?: string) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  if (trimmed.length > MAX_REMARKS_LENGTH) {
    throw new ConvexError(
      `Remarks must be ${MAX_REMARKS_LENGTH} characters or fewer.`,
    );
  }

  return trimmed;
}

function validateDateRange(startDate: string, endDate: string) {
  const startDay = dateStringToDayIndex(startDate);
  const endDay = dateStringToDayIndex(endDate);

  if (endDay < startDay) {
    throw new ConvexError("End date must be on or after the start date.");
  }

  return { startDay, endDay };
}

function sortRecordsDescending<T extends { startDay: number; createdAt: number }>(
  left: T,
  right: T,
) {
  if (right.startDay !== left.startDay) {
    return right.startDay - left.startDay;
  }

  return right.createdAt - left.createdAt;
}

function sortCurrentStateRows<
  T extends { platoon: string; designation: string; name: string; rank: string },
>(left: T, right: T) {
  return (
    left.platoon.localeCompare(right.platoon) ||
    left.designation.localeCompare(right.designation) ||
    left.name.localeCompare(right.name) ||
    left.rank.localeCompare(right.rank)
  );
}

function withDerivedImpact<T extends { status: Status; affectParadeState: boolean }>(
  record: T,
) {
  return {
    ...record,
    affectParadeState: doesStatusAffectParadeState(record.status),
  };
}

export const createRecord = mutation({
  args: {
    personnelKey: v.string(),
    rank: v.string(),
    name: v.string(),
    platoon: v.string(),
    designation: v.string(),
    status: statusValidator,
    startDate: v.string(),
    endDate: v.string(),
    remarks: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { appUser, authUser } = await ensureCurrentUser(ctx, {
      requireApproved: true,
    });
    const { startDay, endDay } = validateDateRange(args.startDate, args.endDate);
    const now = Date.now();

    return await ctx.db.insert("paradeStateRecords", {
      personnelKey: normalizeText(args.personnelKey),
      rank: normalizeText(args.rank),
      name: normalizeText(args.name),
      platoon: normalizeText(args.platoon),
      designation: normalizeText(args.designation),
      status: args.status,
      affectParadeState: doesStatusAffectParadeState(args.status),
      startDate: args.startDate,
      endDate: args.endDate,
      startDay,
      endDay,
      remarks: normalizeRemarks(args.remarks),
      submittedByName: authUser.name?.trim() || appUser.name,
      submittedByEmail: authUser.email,
      submittedByAuthUserId: appUser.authUserId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateRecord = mutation({
  args: {
    recordId: v.id("paradeStateRecords"),
    status: statusValidator,
    startDate: v.string(),
    endDate: v.string(),
    remarks: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ensureCurrentUser(ctx, { requireApproved: true });

    const existing = await ctx.db.get(args.recordId);
    if (!existing) {
      throw new ConvexError("The selected record no longer exists.");
    }

    const { startDay, endDay } = validateDateRange(args.startDate, args.endDate);

    await ctx.db.patch(args.recordId, {
      status: args.status,
      affectParadeState: doesStatusAffectParadeState(args.status),
      startDate: args.startDate,
      endDate: args.endDate,
      startDay,
      endDay,
      remarks: normalizeRemarks(args.remarks),
      updatedAt: Date.now(),
    });
  },
});

export const adjustEndDate = mutation({
  args: {
    recordId: v.id("paradeStateRecords"),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureCurrentUser(ctx, { requireApproved: true });

    const existing = await ctx.db.get(args.recordId);
    if (!existing) {
      throw new ConvexError("The selected record no longer exists.");
    }

    const { endDay } = validateDateRange(existing.startDate, args.endDate);

    await ctx.db.patch(args.recordId, {
      endDate: args.endDate,
      endDay,
      updatedAt: Date.now(),
    });
  },
});

export const listCurrentState = query({
  args: {},
  handler: async (ctx) => {
    await ensureCurrentUser(ctx, { requireApproved: true });

    const todayDay = getTodaySingaporeDayIndex();
    const records = await ctx.db
      .query("paradeStateRecords")
      .withIndex("by_endDay", (q) => q.gte("endDay", todayDay))
      .collect();

    const activeRecords = records
      .map(withDerivedImpact)
      .filter((record) => record.startDay <= todayDay)
      .sort(sortRecordsDescending);

    const grouped = new Map<string, typeof activeRecords>();

    activeRecords.forEach((record) => {
      const existing = grouped.get(record.personnelKey) ?? [];
      existing.push(record);
      grouped.set(record.personnelKey, existing);
    });

    return Array.from(grouped.values())
      .map((groupRecords) => {
        const firstRecord = groupRecords[0];
        const activeStatuses = Array.from(
          new Set(groupRecords.map((record) => record.status)),
        ) as Status[];

        return {
          personnelKey: firstRecord.personnelKey,
          rank: firstRecord.rank,
          name: firstRecord.name,
          platoon: firstRecord.platoon,
          designation: firstRecord.designation,
          activeStatuses,
          activeRecordCount: groupRecords.length,
          hasParadeStateImpact: groupRecords.some(
            (record) => record.affectParadeState,
          ),
          records: groupRecords,
        };
      })
      .sort(sortCurrentStateRows);
  },
});

export const listRecordLog = query({
  args: {},
  handler: async (ctx) => {
    await ensureCurrentUser(ctx, { requireApproved: true });

    const records = await ctx.db
      .query("paradeStateRecords")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();

    return records.map(withDerivedImpact);
  },
});

export const listRecordsForPersonnel = query({
  args: {
    personnelKey: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureCurrentUser(ctx, { requireApproved: true });

    const records = await ctx.db
      .query("paradeStateRecords")
      .withIndex("by_personnelKey", (q) => q.eq("personnelKey", args.personnelKey))
      .order("desc")
      .collect();

    return records.map(withDerivedImpact).sort(sortRecordsDescending);
  },
});
