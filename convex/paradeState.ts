import { ConvexError, v } from "convex/values";

import {
  MAX_CUSTOM_STATUS_LENGTH,
  MAX_REMARKS_LENGTH,
  doesStatusAffectParadeState,
  isOtherStatus,
  isPermanentRecord,
  type Status,
} from "../src/lib/constants";
import {
  dateStringToDayIndex,
  getTodaySingaporeDayIndex,
} from "../src/lib/date";
import { mutation, query } from "./_generated/server";
import { statusValidator } from "./statusValidator";
import { ensureCurrentUser } from "./users";

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

function normalizeCustomStatus(value?: string) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  const normalized = trimmed.replace(/\s+/g, " ");

  if (normalized.length > MAX_CUSTOM_STATUS_LENGTH) {
    throw new ConvexError(
      `Custom status must be ${MAX_CUSTOM_STATUS_LENGTH} characters or fewer.`,
    );
  }

  return normalized;
}

function resolveParadeStateImpact(
  status: Status,
  affectParadeState?: boolean,
) {
  if (isOtherStatus(status)) {
    if (affectParadeState === undefined) {
      throw new ConvexError("Select whether the custom status affects parade state.");
    }

    return affectParadeState;
  }

  return doesStatusAffectParadeState(status);
}

function resolveRecordDates(
  startDate: string,
  endDate: string | undefined,
  isPermanent: boolean,
) {
  const startDay = dateStringToDayIndex(startDate);

  if (isPermanent) {
    return { startDay, endDate: undefined, endDay: undefined };
  }

  if (!endDate) {
    throw new ConvexError("End date is required unless the status is permanent.");
  }

  const endDay = dateStringToDayIndex(endDate);

  if (endDay < startDay) {
    throw new ConvexError("End date must be on or after the start date.");
  }

  return { startDay, endDate, endDay };
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

function withDerivedImpact<
  T extends {
    status: Status;
    customStatus?: string;
    affectParadeState: boolean;
    isPermanent?: boolean;
    endDate?: string;
  },
>(
  record: T,
) {
  return {
    ...record,
    isPermanent: isPermanentRecord(record),
    affectParadeState: resolveParadeStateImpact(
      record.status,
      record.affectParadeState,
    ),
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
    customStatus: v.optional(v.string()),
    isPermanent: v.boolean(),
    affectParadeState: v.optional(v.boolean()),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    remarks: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { appUser, authUser } = await ensureCurrentUser(ctx, {
      requireApproved: true,
    });
    const { startDay, endDate, endDay } = resolveRecordDates(
      args.startDate,
      args.endDate?.trim() || undefined,
      args.isPermanent,
    );
    const now = Date.now();
    const customStatus = normalizeCustomStatus(args.customStatus);

    if (isOtherStatus(args.status) && !customStatus) {
      throw new ConvexError("Enter the custom status for Others.");
    }

    return await ctx.db.insert("paradeStateRecords", {
      personnelKey: normalizeText(args.personnelKey),
      rank: normalizeText(args.rank),
      name: normalizeText(args.name),
      platoon: normalizeText(args.platoon),
      designation: normalizeText(args.designation),
      status: args.status,
      customStatus,
      isPermanent: args.isPermanent,
      affectParadeState: resolveParadeStateImpact(
        args.status,
        args.affectParadeState,
      ),
      startDate: args.startDate,
      endDate,
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
    customStatus: v.optional(v.string()),
    isPermanent: v.boolean(),
    affectParadeState: v.optional(v.boolean()),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    remarks: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ensureCurrentUser(ctx, { requireApproved: true });

    const existing = await ctx.db.get(args.recordId);
    if (!existing) {
      throw new ConvexError("The selected record no longer exists.");
    }

    const { startDay, endDate, endDay } = resolveRecordDates(
      args.startDate,
      args.endDate?.trim() || undefined,
      args.isPermanent,
    );
    const customStatus = normalizeCustomStatus(args.customStatus);

    if (isOtherStatus(args.status) && !customStatus) {
      throw new ConvexError("Enter the custom status for Others.");
    }

    await ctx.db.patch(args.recordId, {
      status: args.status,
      customStatus,
      isPermanent: args.isPermanent,
      affectParadeState: resolveParadeStateImpact(
        args.status,
        args.affectParadeState,
      ),
      startDate: args.startDate,
      endDate,
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

    if (isPermanentRecord(existing)) {
      throw new ConvexError("Permanent records do not have an end date to adjust.");
    }

    const { endDate, endDay } = resolveRecordDates(
      existing.startDate,
      args.endDate,
      false,
    );

    await ctx.db.patch(args.recordId, {
      endDate,
      endDay,
      updatedAt: Date.now(),
    });
  },
});

export const deleteRecord = mutation({
  args: {
    recordId: v.id("paradeStateRecords"),
  },
  handler: async (ctx, args) => {
    await ensureCurrentUser(ctx, { requireApproved: true });

    const existing = await ctx.db.get(args.recordId);
    if (!existing) {
      throw new ConvexError("The selected record no longer exists.");
    }

    await ctx.db.delete(args.recordId);
  },
});

export const listCurrentState = query({
  args: {},
  handler: async (ctx) => {
    await ensureCurrentUser(ctx, { requireApproved: true });

    const todayDay = getTodaySingaporeDayIndex();
    const permanentRecords = await ctx.db
      .query("paradeStateRecords")
      .withIndex("by_isPermanent", (q) => q.eq("isPermanent", true))
      .collect();
    const datedRecords = await ctx.db
      .query("paradeStateRecords")
      .withIndex("by_endDay", (q) => q.gte("endDay", todayDay))
      .collect();

    const activeRecords = [...permanentRecords, ...datedRecords]
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
          new Map(
            groupRecords.map((record) => [
              `${record.status}::${record.customStatus ?? ""}`,
              {
                status: record.status,
                customStatus: record.customStatus,
              },
            ]),
          ).values(),
        );

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

export const listActiveRecordsForDate = query({
  args: {
    date: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureCurrentUser(ctx, { requireApproved: true });

    const targetDay = dateStringToDayIndex(args.date);
    const permanentRecords = await ctx.db
      .query("paradeStateRecords")
      .withIndex("by_isPermanent", (q) => q.eq("isPermanent", true))
      .collect();
    const datedRecords = await ctx.db
      .query("paradeStateRecords")
      .withIndex("by_endDay", (q) => q.gte("endDay", targetDay))
      .collect();

    return [...permanentRecords, ...datedRecords]
      .map(withDerivedImpact)
      .filter((record) => record.startDay <= targetDay)
      .sort(sortRecordsDescending);
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
