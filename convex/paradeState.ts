import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";

import {
  DUPLICATE_STATUS_RECORD_MESSAGE,
  MAX_CUSTOM_STATUS_LENGTH,
  MAX_REMARKS_LENGTH,
  formatStatusLabel,
  getStatusRecordPeriodConfig,
  doesStatusAffectParadeState,
  isMaStatus,
  isOtherStatus,
  isPermanentRecord,
  shouldShowOutOfCampToggle,
  type Status,
} from "../src/lib/constants";
import {
  addDaysToDateString,
  dateStringToDayIndex,
  getTodaySingaporeDayIndex,
  isTimeInHHmmWindow,
  isValidMaTimeSlot,
  isValidTimeHHmm,
} from "../src/lib/date";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  paradeStateSnapshotDutyAssignmentValidator,
  paradeStateSnapshotPersonnelValidator,
  paradeStateSnapshotRecordValidator,
} from "./paradeStateSnapshotValidators";
import { statusValidator } from "./statusValidator";
import { ensureCurrentUser } from "./users";

const DUPLICATE_STATUS_RECORD_CODE = "DUPLICATE_STATUS_RECORD";

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

function normalizeMaTimeWindow(
  status: Status,
  startTime?: string,
  endTime?: string,
) {
  if (!isMaStatus(status)) {
    return { startTime: undefined, endTime: undefined };
  }

  const normalizedStartTime = startTime?.trim() ?? "";
  const normalizedEndTime = endTime?.trim() ?? "";

  if (!normalizedStartTime || !normalizedEndTime) {
    throw new ConvexError("Start time and end time are required for MA.");
  }

  if (
    !isValidTimeHHmm(normalizedStartTime) ||
    !isValidTimeHHmm(normalizedEndTime)
  ) {
    throw new ConvexError('MA times must use the "HHmm" format.');
  }

  if (!isValidMaTimeSlot(normalizedStartTime) || !isValidMaTimeSlot(normalizedEndTime)) {
    throw new ConvexError("MA times must be between 0600 and 1900 in 10-minute intervals.");
  }

  if (normalizedEndTime < normalizedStartTime) {
    throw new ConvexError("MA end time must be on or after the start time.");
  }

  return { startTime: normalizedStartTime, endTime: normalizedEndTime };
}

function isMaRecordActiveAtTime(
  record: { status: Status; startTime?: string; endTime?: string },
  asAtTime?: string,
) {
  if (!isMaStatus(record.status) || !asAtTime) {
    return true;
  }

  if (!record.startTime || !record.endTime) {
    return true;
  }

  return isTimeInHHmmWindow({
    startTime: record.startTime,
    endTime: record.endTime,
    targetTime: asAtTime,
  });
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

  if (shouldShowOutOfCampToggle(status) && affectParadeState !== undefined) {
    return affectParadeState;
  }

  return doesStatusAffectParadeState(status);
}

function resolveRecordDates(
  status: Status,
  startDate: string,
  endDate: string | undefined,
  isPermanent: boolean,
) {
  const startDay = dateStringToDayIndex(startDate);
  const { fixedDurationDays } = getStatusRecordPeriodConfig(status);

  if (fixedDurationDays !== undefined) {
    const resolvedEndDate = addDaysToDateString(
      startDate,
      Math.max(fixedDurationDays - 1, 0),
    );

    return {
      startDay,
      isPermanent: false,
      endDate: resolvedEndDate,
      endDay: dateStringToDayIndex(resolvedEndDate),
    };
  }

  if (isPermanent) {
    return { startDay, isPermanent, endDate: undefined, endDay: undefined };
  }

  if (!endDate) {
    throw new ConvexError("End date is required unless the status is permanent.");
  }

  const endDay = dateStringToDayIndex(endDate);

  if (endDay < startDay) {
    throw new ConvexError("End date must be on or after the start date.");
  }

  return { startDay, isPermanent, endDate, endDay };
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
    startTime?: string;
    endTime?: string;
  },
>(
  record: T,
  asAtTime?: string,
) {
  return {
    ...record,
    isPermanent: isPermanentRecord(record),
    affectParadeState:
      isMaStatus(record.status) && asAtTime
        ? isMaRecordActiveAtTime(record, asAtTime)
        : resolveParadeStateImpact(record.status, record.affectParadeState),
  };
}

function buildRecordSearchText(record: {
  rank: string;
  name: string;
  platoon: string;
  designation: string;
  status: Status;
  customStatus?: string;
}) {
  return [
    record.rank,
    record.name,
    record.platoon,
    record.designation,
    formatStatusLabel(record.status, record.customStatus),
    record.customStatus,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

async function ensureNoDuplicateRecord(
  ctx: MutationCtx,
  {
    personnelKey,
    status,
    customStatus,
    isPermanent,
    startDay,
    endDay,
    startTime,
    endTime,
  }: {
    personnelKey: string;
    status: Status;
    customStatus?: string;
    isPermanent: boolean;
    startDay: number;
    endDay?: number;
    startTime?: string;
    endTime?: string;
  },
) {
  const existingRecords = await ctx.db
    .query("paradeStateRecords")
    .withIndex("by_personnelKey", (q) => q.eq("personnelKey", personnelKey))
    .collect();

  const duplicate = existingRecords.find(
    (record) =>
      record.status === status &&
      (record.customStatus ?? undefined) === (customStatus ?? undefined) &&
      isPermanentRecord(record) === isPermanent &&
      record.startDay === startDay &&
      (record.endDay ?? undefined) === (endDay ?? undefined) &&
      (record.startTime ?? undefined) === (startTime ?? undefined) &&
      (record.endTime ?? undefined) === (endTime ?? undefined),
  );

  if (duplicate) {
    throw new ConvexError({
      code: DUPLICATE_STATUS_RECORD_CODE,
      message: DUPLICATE_STATUS_RECORD_MESSAGE,
      recordId: duplicate._id,
    });
  }
}

async function listSnapshotDocsForDate(
  ctx: QueryCtx | MutationCtx,
  snapshotDate: string,
) {
  return await ctx.db
    .query("paradeStateSnapshots")
    .withIndex("by_snapshotDate", (q) => q.eq("snapshotDate", snapshotDate))
    .collect();
}

function sortSnapshotsDescending(
  left: Doc<"paradeStateSnapshots">,
  right: Doc<"paradeStateSnapshots">,
) {
  if (right.updatedAt !== left.updatedAt) {
    return right.updatedAt - left.updatedAt;
  }

  return right._creationTime - left._creationTime;
}

function normalizeSnapshotPersonnel(
  personnel: {
    personnelKey: string;
    rank: string;
    name: string;
    platoon: string;
    designation: string;
    alias?: string;
    label: string;
  }[],
) {
  return personnel.map((person) => ({
    personnelKey: normalizeText(person.personnelKey),
    rank: normalizeText(person.rank),
    name: normalizeText(person.name),
    platoon: normalizeText(person.platoon),
    designation: normalizeText(person.designation),
    alias: person.alias?.trim() ? normalizeText(person.alias) : undefined,
    label: normalizeText(person.label),
  }));
}

function normalizeSnapshotRecords(
  records: {
    personnelKey: string;
    rank: string;
    name: string;
    platoon: string;
    designation: string;
    status: Status;
    customStatus?: string;
    isPermanent?: boolean;
    affectParadeState: boolean;
    startDate: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    remarks?: string;
    createdAt: number;
    updatedAt: number;
  }[],
) {
  return records.map((record) => ({
    personnelKey: normalizeText(record.personnelKey),
    rank: normalizeText(record.rank),
    name: normalizeText(record.name),
    platoon: normalizeText(record.platoon),
    designation: normalizeText(record.designation),
    status: record.status,
    customStatus: normalizeCustomStatus(record.customStatus),
    isPermanent: record.isPermanent,
    affectParadeState: record.affectParadeState,
    startDate: record.startDate,
    endDate: record.endDate?.trim() || undefined,
    startTime: record.startTime?.trim() || undefined,
    endTime: record.endTime?.trim() || undefined,
    remarks: normalizeRemarks(record.remarks),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }));
}

function normalizeSnapshotDutyAssignments(
  assignments: {
    personnelKey: string;
    rank: string;
    name: string;
    platoon: string;
    designation: string;
    dutyType: string;
    dutyTypeNormalized: string;
    dutyPreset: "CDO" | "DOO" | "CDS" | "COS" | "COS RESERVE" | null;
    dateOfDuty: string;
    dutyDay: number;
    points: number;
    isExtra: boolean;
    createdAt: number;
    updatedAt: number;
  }[],
) {
  return assignments.map((assignment) => ({
    personnelKey: normalizeText(assignment.personnelKey),
    rank: normalizeText(assignment.rank),
    name: normalizeText(assignment.name),
    platoon: normalizeText(assignment.platoon),
    designation: normalizeText(assignment.designation),
    dutyType: normalizeText(assignment.dutyType),
    dutyTypeNormalized: normalizeText(assignment.dutyTypeNormalized),
    dutyPreset: assignment.dutyPreset,
    dateOfDuty: assignment.dateOfDuty,
    dutyDay: assignment.dutyDay,
    points: assignment.points,
    isExtra: assignment.isExtra,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
  }));
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
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    remarks: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { appUser, authUser } = await ensureCurrentUser(ctx, {
      requireApproved: true,
      requirePermission: "statusRecords.manage",
    });
    const { startDay, isPermanent, endDate, endDay } = resolveRecordDates(
      args.status,
      args.startDate,
      args.endDate?.trim() || undefined,
      args.isPermanent,
    );
    const now = Date.now();
    const customStatus = normalizeCustomStatus(args.customStatus);
    const maTimeWindow = normalizeMaTimeWindow(
      args.status,
      args.startTime,
      args.endTime,
    );

    if (isOtherStatus(args.status) && !customStatus) {
      throw new ConvexError("Enter the custom status for Others.");
    }

    const personnelKey = normalizeText(args.personnelKey);
    const rank = normalizeText(args.rank);
    const name = normalizeText(args.name);
    const platoon = normalizeText(args.platoon);
    const designation = normalizeText(args.designation);
    const affectParadeState = resolveParadeStateImpact(
      args.status,
      args.affectParadeState,
    );
    await ensureNoDuplicateRecord(ctx, {
      personnelKey,
      status: args.status,
      customStatus,
      isPermanent,
      startDay,
      endDay,
      startTime: maTimeWindow.startTime,
      endTime: maTimeWindow.endTime,
    });

    return await ctx.db.insert("paradeStateRecords", {
      personnelKey,
      rank,
      name,
      platoon,
      designation,
      status: args.status,
      customStatus,
      isPermanent,
      affectParadeState,
      startDate: args.startDate,
      endDate,
      startTime: maTimeWindow.startTime,
      endTime: maTimeWindow.endTime,
      startDay,
      endDay,
      remarks: normalizeRemarks(args.remarks),
      searchText: buildRecordSearchText({
        rank,
        name,
        platoon,
        designation,
        status: args.status,
        customStatus,
      }),
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
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    remarks: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ensureCurrentUser(ctx, {
      requireApproved: true,
      requirePermission: "statusRecords.manage",
    });

    const existing = await ctx.db.get(args.recordId);
    if (!existing) {
      throw new ConvexError("The selected record no longer exists.");
    }

    const { startDay, isPermanent, endDate, endDay } = resolveRecordDates(
      args.status,
      args.startDate,
      args.endDate?.trim() || undefined,
      args.isPermanent,
    );
    const customStatus = normalizeCustomStatus(args.customStatus);
    const maTimeWindow = normalizeMaTimeWindow(
      args.status,
      args.startTime,
      args.endTime,
    );

    if (isOtherStatus(args.status) && !customStatus) {
      throw new ConvexError("Enter the custom status for Others.");
    }

    const affectParadeState = resolveParadeStateImpact(
      args.status,
      args.affectParadeState,
    );

    await ctx.db.patch(args.recordId, {
      status: args.status,
      customStatus,
      isPermanent,
      affectParadeState,
      startDate: args.startDate,
      endDate,
      startTime: maTimeWindow.startTime,
      endTime: maTimeWindow.endTime,
      startDay,
      endDay,
      remarks: normalizeRemarks(args.remarks),
      searchText: buildRecordSearchText({
        rank: existing.rank,
        name: existing.name,
        platoon: existing.platoon,
        designation: existing.designation,
        status: args.status,
        customStatus,
      }),
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
    await ensureCurrentUser(ctx, {
      requireApproved: true,
      requirePermission: "statusRecords.manage",
    });

    const existing = await ctx.db.get(args.recordId);
    if (!existing) {
      throw new ConvexError("The selected record no longer exists.");
    }

    if (isPermanentRecord(existing)) {
      throw new ConvexError("Permanent records do not have an end date to adjust.");
    }

    const { endDate, endDay } = resolveRecordDates(
      existing.status,
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
    await ensureCurrentUser(ctx, {
      requireApproved: true,
      requirePermission: "statusRecords.manage",
    });

    const existing = await ctx.db.get(args.recordId);
    if (!existing) {
      throw new ConvexError("The selected record no longer exists.");
    }

    await ctx.db.delete(args.recordId);
  },
});

export const listCurrentState = query({
  args: {
    platoon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ensureCurrentUser(ctx, {
      requireApproved: true,
      requirePermission: "statusRecords.manage",
    });

    const todayDay = getTodaySingaporeDayIndex();
    const permanentRecords = args.platoon
      ? await ctx.db
          .query("paradeStateRecords")
          .withIndex("by_platoon_and_isPermanent", (q) =>
            q.eq("platoon", args.platoon!).eq("isPermanent", true),
          )
          .collect()
      : await ctx.db
          .query("paradeStateRecords")
          .withIndex("by_isPermanent", (q) => q.eq("isPermanent", true))
          .collect();
    const datedRecords = args.platoon
      ? await ctx.db
          .query("paradeStateRecords")
          .withIndex("by_platoon_and_endDay", (q) =>
            q.eq("platoon", args.platoon!).gte("endDay", todayDay),
          )
          .collect()
      : await ctx.db
          .query("paradeStateRecords")
          .withIndex("by_endDay", (q) => q.gte("endDay", todayDay))
          .collect();

    const activeRecords = [...permanentRecords, ...datedRecords]
      .map((record) => withDerivedImpact(record))
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
        };
      })
      .sort(sortCurrentStateRows);
  },
});

export const listActiveRecordsForDate = query({
  args: {
    date: v.string(),
    asAtTime: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ensureCurrentUser(ctx, {
      requireApproved: true,
      requirePermission: "statusRecords.manage",
    });

    const targetDay = dateStringToDayIndex(args.date);
    if (args.asAtTime !== undefined && !isValidTimeHHmm(args.asAtTime)) {
      throw new ConvexError('As-at time must use the "HHmm" format.');
    }

    const permanentRecords = await ctx.db
      .query("paradeStateRecords")
      .withIndex("by_isPermanent", (q) => q.eq("isPermanent", true))
      .collect();
    const datedRecords = await ctx.db
      .query("paradeStateRecords")
      .withIndex("by_endDay", (q) => q.gte("endDay", targetDay))
      .collect();

    return [...permanentRecords, ...datedRecords]
      .filter(
        (record) =>
          record.startDay <= targetDay &&
          isMaRecordActiveAtTime(record, args.asAtTime),
      )
      .map((record) => withDerivedImpact(record, args.asAtTime))
      .sort(sortRecordsDescending);
  },
});

export const listRecordLog = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    statuses: v.optional(v.array(statusValidator)),
    platoon: v.optional(v.string()),
    fromDate: v.string(),
    toDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ensureCurrentUser(ctx, {
      requireApproved: true,
      requirePermission: "statusRecords.manage",
    });

    const search = args.search?.trim().toLowerCase();
    const statuses = args.statuses ?? [];
    const fromDay = dateStringToDayIndex(args.fromDate);
    const toDay = args.toDate ? dateStringToDayIndex(args.toDate) : undefined;

    const filteredRecordLogQuery = search
      ? ctx.db
          .query("paradeStateRecords")
          .withSearchIndex("search_recordLog", (q) => {
            let searchQuery = q.search("searchText", search);

            if (args.platoon) {
              searchQuery = searchQuery.eq("platoon", args.platoon);
            }

            if (statuses.length === 1) {
              searchQuery = searchQuery.eq("status", statuses[0]!);
            }

            return searchQuery;
          })
      : args.platoon
        ? ctx.db
            .query("paradeStateRecords")
            .withIndex("by_platoon_and_createdAt", (q) =>
              q.eq("platoon", args.platoon!),
            )
            .order("desc")
        : statuses.length === 1
          ? ctx.db
              .query("paradeStateRecords")
              .withIndex("by_status_and_createdAt", (q) =>
                q.eq("status", statuses[0]!),
              )
              .order("desc")
            : ctx.db
                .query("paradeStateRecords")
                .withIndex("by_createdAt")
                .order("desc");

    const records = await filteredRecordLogQuery
      .filter((q) => {
        const dateFilter =
          toDay === undefined
            ? q.or(
                q.eq(q.field("isPermanent"), true),
                q.eq(q.field("endDay"), undefined),
                q.gte(q.field("endDay"), fromDay),
              )
            : q.and(
                q.lte(q.field("startDay"), toDay),
                q.or(
                  q.eq(q.field("isPermanent"), true),
                  q.eq(q.field("endDay"), undefined),
                  q.gte(q.field("endDay"), fromDay),
                ),
              );
        const statusFilter =
          statuses.length === 0
            ? true
            : statuses.length === 1
              ? q.eq(q.field("status"), statuses[0]!)
              : q.or(
                  ...statuses.map((status) => q.eq(q.field("status"), status)),
                );
        const platoonFilter = args.platoon
          ? q.eq(q.field("platoon"), args.platoon)
          : true;

        return q.and(dateFilter, statusFilter, platoonFilter);
      })
      .paginate(args.paginationOpts);

    return {
      ...records,
      page: records.page.map((record) => withDerivedImpact(record)),
    };
  },
});

export const backfillRecordSearchTextBatch = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(args.batchSize ?? 200, 1), 200);
    const records = await ctx.db
      .query("paradeStateRecords")
      .withIndex("by_createdAt")
      .filter((q) => q.eq(q.field("searchText"), undefined))
      .take(batchSize);

    for (const record of records) {
      await ctx.db.patch(record._id, {
        searchText: buildRecordSearchText(record),
      });
    }

    return {
      patchedCount: records.length,
      hasMore: records.length === batchSize,
    };
  },
});

export const getRecord = query({
  args: {
    recordId: v.id("paradeStateRecords"),
  },
  handler: async (ctx, args) => {
    await ensureCurrentUser(ctx, {
      requireApproved: true,
      requirePermission: "statusRecords.manage",
    });

    const record = await ctx.db.get(args.recordId);

    return record ? withDerivedImpact(record) : null;
  },
});

export const getSnapshotForDate = query({
  args: {
    date: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureCurrentUser(ctx, {
      requireApproved: true,
      requirePermission: "paradeReport.view",
    });

    dateStringToDayIndex(args.date);
    const snapshots = await listSnapshotDocsForDate(ctx, args.date);

    return snapshots.sort(sortSnapshotsDescending)[0] ?? null;
  },
});

export const saveSnapshot = mutation({
  args: {
    date: v.string(),
    asAtTime: v.string(),
    personnel: v.array(paradeStateSnapshotPersonnelValidator),
    activeRecords: v.array(paradeStateSnapshotRecordValidator),
    dutyAssignments: v.array(paradeStateSnapshotDutyAssignmentValidator),
  },
  handler: async (ctx, args) => {
    const { appUser, authUser } = await ensureCurrentUser(ctx, {
      requireApproved: true,
      requirePermission: "paradeReport.view",
    });

    if (!isValidTimeHHmm(args.asAtTime)) {
      throw new ConvexError('As-at time must use the "HHmm" format.');
    }

    const snapshotDay = dateStringToDayIndex(args.date);
    const now = Date.now();
    const personnel = normalizeSnapshotPersonnel(args.personnel);
    const activeRecords = normalizeSnapshotRecords(args.activeRecords);
    const dutyAssignments = normalizeSnapshotDutyAssignments(args.dutyAssignments);

    for (const record of activeRecords) {
      dateStringToDayIndex(record.startDate);

      if (record.endDate) {
        dateStringToDayIndex(record.endDate);
      }
    }

    for (const assignment of dutyAssignments) {
      if (assignment.dateOfDuty !== args.date) {
        throw new ConvexError(
          "Duty assignments in a parade snapshot must match the selected date.",
        );
      }
    }

    const existingSnapshots = (await listSnapshotDocsForDate(ctx, args.date)).sort(
      sortSnapshotsDescending,
    );
    const [existingSnapshot, ...staleSnapshots] = existingSnapshots;

    for (const snapshot of staleSnapshots) {
      await ctx.db.delete(snapshot._id);
    }

    const snapshotFields = {
      snapshotDate: args.date,
      snapshotDay,
      asAtTime: args.asAtTime,
      personnel,
      activeRecords,
      dutyAssignments,
      savedByName: authUser.name?.trim() || appUser.name,
      savedByEmail: authUser.email,
      savedByAuthUserId: appUser.authUserId,
      updatedAt: now,
    };

    if (existingSnapshot) {
      await ctx.db.patch(existingSnapshot._id, snapshotFields);
      return existingSnapshot._id;
    }

    return await ctx.db.insert("paradeStateSnapshots", {
      ...snapshotFields,
      createdAt: now,
    });
  },
});

export const deleteSnapshot = mutation({
  args: {
    date: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureCurrentUser(ctx, {
      requireApproved: true,
      requirePermission: "paradeReport.view",
    });

    dateStringToDayIndex(args.date);
    const existingSnapshots = await listSnapshotDocsForDate(ctx, args.date);

    if (existingSnapshots.length === 0) {
      throw new ConvexError("No saved snapshot exists for that date.");
    }

    for (const snapshot of existingSnapshots) {
      await ctx.db.delete(snapshot._id);
    }

    return { deletedCount: existingSnapshots.length };
  },
});

export const listRecordsForPersonnel = query({
  args: {
    personnelKey: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureCurrentUser(ctx, {
      requireApproved: true,
      requirePermission: "statusRecords.manage",
    });

    const records = await ctx.db
      .query("paradeStateRecords")
      .withIndex("by_personnelKey", (q) => q.eq("personnelKey", args.personnelKey))
      .order("desc")
      .collect();

    return records
      .map((record) => withDerivedImpact(record))
      .sort(sortRecordsDescending);
  },
});
