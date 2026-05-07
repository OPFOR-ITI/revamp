import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";

import {
  CONDUCT_ELIGIBLE_PLATOON_ORDER,
  buildConductWhatsappData,
  formatConductWhatsappMessage,
  isConductEligiblePlatoon,
} from "../src/lib/conduct-whatsapp";
import {
  type ConductAttendanceReason,
  type ConductNonPresentReason,
  getConductAttendanceStatusMapping,
  normalizeAttendanceComparableName,
} from "../src/lib/conduct-attendance";
import { MAX_REMARKS_LENGTH } from "../src/lib/constants";
import {
  dateStringToDayIndex,
  getTodaySingaporeDayIndex,
  isValidDateString,
} from "../src/lib/date";
import {
  formatParadeStateStatusLabel,
  pickPrimaryParadeStateRecord,
} from "../src/lib/parade-state-precedence";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { ensureCurrentUser } from "./users";

const nominalRollSeedItemValidator = v.object({
  personnelKey: v.string(),
  rank: v.string(),
  name: v.string(),
  platoon: v.string(),
});

const conductAttendanceUpdateReasonValidator = v.union(
  v.literal("Present"),
  v.literal("MC"),
  v.literal("Leave"),
  v.literal("Off"),
  v.literal("Fall Out"),
  v.literal("Other"),
);

const conductAttendanceUpdateInputValidator = v.object({
  personnelKey: v.string(),
  reason: conductAttendanceUpdateReasonValidator,
  remarks: v.optional(v.string()),
});

type EffectiveAttendanceEntry = {
  _id: Id<"conductAttendanceEntries">;
  _creationTime: number;
  conductId: Id<"conducts">;
  personnelKey: string;
  rank: string;
  name: string;
  platoon: string;
  reason: ConductNonPresentReason;
  remarks?: string;
  createdAt: number;
  updatedAt: number;
};

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeConductName(value: string) {
  const normalized = normalizeText(value);

  if (!normalized) {
    throw new ConvexError("Conduct name is required.");
  }

  return normalized;
}

function normalizeConductDescription(value?: string) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  return normalizeText(trimmed);
}

function normalizeAttendanceRemarks(
  value: string | undefined,
  reason: ConductNonPresentReason,
) {
  const trimmed = value?.trim();

  if (!trimmed) {
    if (reason === "Other") {
      throw new ConvexError('Remarks are required when the reason is "Other".');
    }

    return undefined;
  }

  const normalized = trimmed.replace(/\s+/g, " ");

  if (normalized.length > MAX_REMARKS_LENGTH) {
    throw new ConvexError(
      `Remarks must be ${MAX_REMARKS_LENGTH} characters or fewer.`,
    );
  }

  return normalized;
}

function shouldTrackParadeStateRecordForConductAttendance(record: {
  status: string;
  customStatus?: string;
  affectParadeState: boolean;
}) {
  return (
    record.affectParadeState ||
    getConductAttendanceStatusMapping(record.status, record.customStatus) !== null
  );
}

function mapParadeStateRecordToConductAttendance(record: {
  status: string;
  customStatus?: string;
}): {
  reason: ConductNonPresentReason;
  remarks?: string;
} {
  const statusLabel = formatParadeStateStatusLabel(
    record.status,
    record.customStatus,
  );
  const mapping = getConductAttendanceStatusMapping(
    record.status,
    record.customStatus,
  );

  if (mapping) {
    return {
      reason: mapping.reason,
      remarks: mapping.includeStatusAsRemarks ? statusLabel : undefined,
    };
  }

  return {
    reason: "Other",
    remarks: statusLabel,
  };
}

function validateConductDate(value: string) {
  if (!isValidDateString(value)) {
    throw new ConvexError('Conduct date must use the format "YYYY-MM-DD".');
  }

  return dateStringToDayIndex(value);
}

function validateNumberOfPeriods(value: number) {
  if (!Number.isInteger(value) || value < 1) {
    throw new ConvexError("Number of periods must be a whole number of at least 1.");
  }

  return value;
}

function sortConductsDescending<T extends { createdAt: number }>(
  left: T,
  right: T,
) {
  return right.createdAt - left.createdAt;
}

function sortSnapshotPersonnel<
  T extends { platoon: string; name: string; rank: string },
>(left: T, right: T) {
  return (
    CONDUCT_ELIGIBLE_PLATOON_ORDER.indexOf(
      left.platoon as (typeof CONDUCT_ELIGIBLE_PLATOON_ORDER)[number],
    ) -
      CONDUCT_ELIGIBLE_PLATOON_ORDER.indexOf(
        right.platoon as (typeof CONDUCT_ELIGIBLE_PLATOON_ORDER)[number],
      ) ||
    left.name.localeCompare(right.name) ||
    left.rank.localeCompare(right.rank)
  );
}

function resolveConductSnapshotStatus(date: string, snapshotExists: boolean) {
  if (snapshotExists) {
    return "ready" as const;
  }

  const conductDay = validateConductDate(date);
  const todayDay = getTodaySingaporeDayIndex();

  if (conductDay === todayDay) {
    return "canInitializeToday" as const;
  }

  if (conductDay > todayDay) {
    return "futureLocked" as const;
  }

  return "pastLocked" as const;
}

function filterConductEligiblePersonnel(
  seed: {
    personnelKey: string;
    rank: string;
    name: string;
    platoon: string;
  }[],
) {
  const seen = new Set<string>();

  return seed
    .map((person) => ({
      personnelKey: normalizeText(person.personnelKey),
      rank: normalizeText(person.rank),
      name: normalizeText(person.name),
      platoon: normalizeText(person.platoon),
    }))
    .filter((person) => {
      if (
        !person.personnelKey ||
        !person.rank ||
        !person.name ||
        !person.platoon ||
        !isConductEligiblePlatoon(person.platoon) ||
        seen.has(person.personnelKey)
      ) {
        return false;
      }

      seen.add(person.personnelKey);
      return true;
    })
    .sort(sortSnapshotPersonnel);
}

async function getSnapshotRowsForDate(
  ctx: QueryCtx | MutationCtx,
  date: string,
  day: number,
) {
  const rows = await ctx.db
    .query("conductNominalRollSnapshots")
    .withIndex("by_snapshotDay", (q) => q.eq("snapshotDay", day))
    .collect();

  return rows
    .filter((row) => row.snapshotDate === date && isConductEligiblePlatoon(row.platoon))
    .sort(sortSnapshotPersonnel);
}

async function getStoredAttendanceEntriesForConduct(
  ctx: QueryCtx | MutationCtx,
  conductId: Id<"conducts">,
) {
  const rows = await ctx.db
    .query("conductAttendanceEntries")
    .withIndex("by_conductId", (q) => q.eq("conductId", conductId))
    .collect();

  return rows.filter((row) => isConductEligiblePlatoon(row.platoon));
}

async function getEffectiveAttendanceEntriesForConduct(
  ctx: QueryCtx | MutationCtx,
  conductId: Id<"conducts">,
): Promise<EffectiveAttendanceEntry[]> {
  const storedEntries = await getStoredAttendanceEntriesForConduct(ctx, conductId);
  return storedEntries
    .map((entry) => entry as EffectiveAttendanceEntry)
    .sort(sortSnapshotPersonnel);
}

async function getActiveParadeStateRecordsForDay(
  ctx: QueryCtx | MutationCtx,
  targetDay: number,
) {
  const [permanentRecords, datedRecords] = await Promise.all([
    ctx.db
      .query("paradeStateRecords")
      .withIndex("by_isPermanent", (q) => q.eq("isPermanent", true))
      .collect(),
    ctx.db
      .query("paradeStateRecords")
      .withIndex("by_endDay", (q) => q.gte("endDay", targetDay))
      .collect(),
  ]);

  return [...permanentRecords, ...datedRecords].filter(
    (record) =>
      record.startDay <= targetDay &&
      shouldTrackParadeStateRecordForConductAttendance(record),
  );
}

function buildAttendanceSummary(
  snapshotRows: Awaited<ReturnType<typeof getSnapshotRowsForDate>>,
  attendanceEntries: { personnelKey: string }[],
) {
  const nonPresentCount = attendanceEntries.length;
  const nominalRollCount = snapshotRows.length;

  return {
    nominalRollCount,
    nonPresentCount,
    presentCount: Math.max(nominalRollCount - nonPresentCount, 0),
  };
}

function normalizeAttendanceUpdateInputs(
  updates: {
    personnelKey: string;
    reason: ConductAttendanceReason;
    remarks?: string;
  }[],
  snapshotByKey: Map<
    string,
    Awaited<ReturnType<typeof getSnapshotRowsForDate>>[number]
  >,
) {
  const nextUpdates = new Map<
    string,
    {
      personnelKey: string;
      reason: ConductAttendanceReason;
      remarks?: string;
      person: Awaited<ReturnType<typeof getSnapshotRowsForDate>>[number];
    }
  >();

  for (const update of updates) {
    const personnelKey = normalizeText(update.personnelKey);

    if (!personnelKey) {
      continue;
    }

    const person = snapshotByKey.get(personnelKey);

    if (!person) {
      throw new ConvexError(
        "All saved attendance rows must belong to the conduct snapshot.",
      );
    }

    nextUpdates.set(personnelKey, {
      personnelKey,
      reason: update.reason,
      remarks:
        update.reason === "Present"
          ? undefined
          : normalizeAttendanceRemarks(update.remarks, update.reason),
      person,
    });
  }

  return Array.from(nextUpdates.values()).sort((left, right) =>
    sortSnapshotPersonnel(left.person, right.person),
  );
}

async function ensureSnapshotForTodayIfMissing(
  ctx: MutationCtx,
  {
    date,
    day,
    nominalRollSeed,
  }: {
    date: string;
    day: number;
    nominalRollSeed?: {
      personnelKey: string;
      rank: string;
      name: string;
      platoon: string;
    }[];
  },
) {
  const existing = await getSnapshotRowsForDate(ctx, date, day);

  if (existing.length > 0) {
    return existing;
  }

  const todayDay = getTodaySingaporeDayIndex();

  if (day !== todayDay) {
    if (day > todayDay) {
      throw new ConvexError(
        "Attendance can only be initialized on the conduct date.",
      );
    }

    throw new ConvexError(
      "No nominal-roll snapshot exists for that past conduct date. Backdated first-save is blocked.",
    );
  }

  if (!nominalRollSeed || nominalRollSeed.length === 0) {
    throw new ConvexError(
      "The nominal roll must be loaded before attendance can be initialized.",
    );
  }

  const filteredSeed = filterConductEligiblePersonnel(nominalRollSeed);

  if (filteredSeed.length === 0) {
    throw new ConvexError("The nominal roll snapshot had no eligible personnel.");
  }

  const createdAt = Date.now();

  for (const person of filteredSeed) {
    await ctx.db.insert("conductNominalRollSnapshots", {
      snapshotDate: date,
      snapshotDay: day,
      personnelKey: person.personnelKey,
      rank: person.rank,
      name: person.name,
      platoon: person.platoon,
      createdAt,
    });
  }

  return await getSnapshotRowsForDate(ctx, date, day);
}

export const listConductsForDate = query({
  args: {
    date: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureCurrentUser(ctx, {
      requireApproved: true,
      requirePermission: "conducts.view",
    });

    const conductDay = validateConductDate(args.date);
    const [conducts, snapshotRows] = await Promise.all([
      ctx.db
        .query("conducts")
        .withIndex("by_conductDay", (q) => q.eq("conductDay", conductDay))
        .collect(),
      getSnapshotRowsForDate(ctx, args.date, conductDay),
    ]);

    const nominalRollCount = snapshotRows.length;
    const snapshotExists = nominalRollCount > 0;
    const snapshotStatus = resolveConductSnapshotStatus(args.date, snapshotExists);

    return await Promise.all(
      conducts.sort(sortConductsDescending).map(async (conduct) => {
        const attendanceEntries = await getEffectiveAttendanceEntriesForConduct(
          ctx,
          conduct._id,
        );
        const nonPresentCount = attendanceEntries.length;
        const hasAttendance =
          conduct.attendanceInitializedAt !== undefined || nonPresentCount > 0;
        const whatsappData =
          hasAttendance && snapshotExists
            ? buildConductWhatsappData({
                conductName: conduct.name,
                date: conduct.date,
                snapshot: snapshotRows,
                absentees: attendanceEntries,
              })
            : null;

        return {
          ...conduct,
          nonPresentCount,
          participantCount: hasAttendance && snapshotExists ? nominalRollCount - nonPresentCount : null,
          nominalRollCount: snapshotExists ? nominalRollCount : null,
          snapshotStatus,
          hasAttendance,
          whatsappData,
        };
      }),
    );
  },
});

export const getConductSnapshotSummaryForDate = query({
  args: {
    date: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureCurrentUser(ctx, {
      requireApproved: true,
      requirePermission: "conducts.view",
    });

    const conductDay = validateConductDate(args.date);
    const snapshotRows = await getSnapshotRowsForDate(ctx, args.date, conductDay);

    return {
      nominalRollCount: snapshotRows.length,
      snapshotStatus: resolveConductSnapshotStatus(args.date, snapshotRows.length > 0),
    };
  },
});

export const getConductAttendanceEditorState = query({
  args: {
    conductId: v.id("conducts"),
  },
  handler: async (ctx, args) => {
    await ensureCurrentUser(ctx, {
      requireApproved: true,
      requirePermission: "conducts.view",
    });

    const conduct = await ctx.db.get(args.conductId);

    if (!conduct) {
      throw new ConvexError("The selected conduct no longer exists.");
    }

    const snapshotRows = await getSnapshotRowsForDate(ctx, conduct.date, conduct.conductDay);
    const attendanceEntries = await getEffectiveAttendanceEntriesForConduct(
      ctx,
      conduct._id,
    );

    return {
      conduct,
      snapshotStatus: resolveConductSnapshotStatus(conduct.date, snapshotRows.length > 0),
      snapshotRows,
      attendanceEntries,
      attendanceInitialized:
        conduct.attendanceInitializedAt !== undefined || attendanceEntries.length > 0,
      counts: buildAttendanceSummary(snapshotRows, attendanceEntries),
    };
  },
});

export const createConduct = mutation({
  args: {
    name: v.string(),
    date: v.string(),
    numberOfPeriods: v.number(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { appUser, authUser } = await ensureCurrentUser(ctx, {
      requireApproved: true,
      requirePermission: "conducts.manage",
    });

    const now = Date.now();
    const name = normalizeConductName(args.name);
    const date = normalizeText(args.date);
    const conductDay = validateConductDate(date);

    return await ctx.db.insert("conducts", {
      name,
      date,
      conductDay,
      numberOfPeriods: validateNumberOfPeriods(args.numberOfPeriods),
      description: normalizeConductDescription(args.description),
      attendanceInitializedAt: undefined,
      createdByName: authUser.name?.trim() || appUser.name,
      createdByEmail: authUser.email,
      createdByAuthUserId: appUser.authUserId,
      updatedByName: authUser.name?.trim() || appUser.name,
      updatedByEmail: authUser.email,
      updatedByAuthUserId: appUser.authUserId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateConduct = mutation({
  args: {
    conductId: v.id("conducts"),
    name: v.string(),
    date: v.string(),
    numberOfPeriods: v.number(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { appUser, authUser } = await ensureCurrentUser(ctx, {
      requireApproved: true,
      requirePermission: "conducts.manage",
    });

    const existing = await ctx.db.get(args.conductId);

    if (!existing) {
      throw new ConvexError("The selected conduct no longer exists.");
    }

    const nextDate = normalizeText(args.date);
    const isDateChanging = existing.date !== nextDate;
    const attendanceEntries = await getStoredAttendanceEntriesForConduct(
      ctx,
      existing._id,
    );
    const hasAttendance =
      existing.attendanceInitializedAt !== undefined ||
      attendanceEntries.length > 0;

    if (isDateChanging && hasAttendance) {
      throw new ConvexError(
        "Conduct date cannot be changed after attendance has been recorded.",
      );
    }

    await ctx.db.patch(args.conductId, {
      name: normalizeConductName(args.name),
      date: nextDate,
      conductDay: validateConductDate(nextDate),
      numberOfPeriods: validateNumberOfPeriods(args.numberOfPeriods),
      description: normalizeConductDescription(args.description),
      updatedByName: authUser.name?.trim() || appUser.name,
      updatedByEmail: authUser.email,
      updatedByAuthUserId: appUser.authUserId,
      updatedAt: Date.now(),
    });
  },
});

export const deleteConduct = mutation({
  args: {
    conductId: v.id("conducts"),
  },
  handler: async (ctx, args) => {
    await ensureCurrentUser(ctx, {
      requireApproved: true,
      requirePermission: "conducts.manage",
    });

    const conduct = await ctx.db.get(args.conductId);

    if (!conduct) {
      throw new ConvexError("The selected conduct no longer exists.");
    }

    const attendanceEntries = await getStoredAttendanceEntriesForConduct(
      ctx,
      conduct._id,
    );

    for (const entry of attendanceEntries) {
      await ctx.db.delete(entry._id);
    }

    await ctx.db.delete(conduct._id);

    return { deleted: true };
  },
});

export const autoMarkConductAttendanceFromParadeState = mutation({
  args: {
    conductId: v.id("conducts"),
    nominalRollSeed: v.optional(v.array(nominalRollSeedItemValidator)),
  },
  handler: async (ctx, args) => {
    await ensureCurrentUser(ctx, {
      requireApproved: true,
      requirePermission: "conductAttendance.manage",
    });

    const conduct = await ctx.db.get(args.conductId);

    if (!conduct) {
      throw new ConvexError("The selected conduct no longer exists.");
    }

    const snapshotRows = await ensureSnapshotForTodayIfMissing(ctx, {
      date: conduct.date,
      day: conduct.conductDay,
      nominalRollSeed: args.nominalRollSeed,
    });
    const activeRecords = await getActiveParadeStateRecordsForDay(
      ctx,
      conduct.conductDay,
    );
    const recordsByPersonnelName = new Map<string, typeof activeRecords>();

    for (const record of activeRecords) {
      const personnelName = normalizeAttendanceComparableName(record.name);
      const existing = recordsByPersonnelName.get(personnelName) ?? [];
      existing.push(record);
      recordsByPersonnelName.set(personnelName, existing);
    }

    const attendanceEntries: Array<{
      personnelKey: string;
      rank: string;
      name: string;
      platoon: string;
      reason: ConductNonPresentReason;
      remarks?: string;
    }> = [];

    for (const person of snapshotRows) {
      const primaryRecord = pickPrimaryParadeStateRecord(
        recordsByPersonnelName.get(normalizeAttendanceComparableName(person.name)) ??
          [],
      );

      if (!primaryRecord) {
        continue;
      }

      const mappedAttendance = mapParadeStateRecordToConductAttendance(
        primaryRecord,
      );

      attendanceEntries.push({
        personnelKey: person.personnelKey,
        rank: person.rank,
        name: person.name,
        platoon: person.platoon,
        reason: mappedAttendance.reason,
        remarks: mappedAttendance.remarks,
      });
    }

    attendanceEntries.sort(sortSnapshotPersonnel);

    return {
      snapshotRows,
      attendanceEntries,
      counts: buildAttendanceSummary(snapshotRows, attendanceEntries),
    };
  },
});

export const saveConductAttendance = mutation({
  args: {
    conductId: v.id("conducts"),
    attendanceUpdates: v.array(conductAttendanceUpdateInputValidator),
    nominalRollSeed: v.optional(v.array(nominalRollSeedItemValidator)),
  },
  handler: async (ctx, args) => {
    await ensureCurrentUser(ctx, {
      requireApproved: true,
      requirePermission: "conductAttendance.manage",
    });

    const conduct = await ctx.db.get(args.conductId);

    if (!conduct) {
      throw new ConvexError("The selected conduct no longer exists.");
    }

    const snapshotRows = await ensureSnapshotForTodayIfMissing(ctx, {
      date: conduct.date,
      day: conduct.conductDay,
      nominalRollSeed: args.nominalRollSeed,
    });
    const snapshotByKey = new Map(
      snapshotRows.map((row) => [row.personnelKey, row] as const),
    );
    const attendanceUpdates = normalizeAttendanceUpdateInputs(
      args.attendanceUpdates as {
        personnelKey: string;
        reason: ConductAttendanceReason;
        remarks?: string;
      }[],
      snapshotByKey,
    );
    const existingEntries = await getStoredAttendanceEntriesForConduct(
      ctx,
      conduct._id,
    );
    const existingByKey = new Map(
      existingEntries.map((row) => [row.personnelKey, row] as const),
    );
    const now = Date.now();

    // Apply only submitted personnel updates so concurrent saves for other rows
    // are not removed by a stale dialog payload.
    for (const update of attendanceUpdates) {
      const existing = existingByKey.get(update.personnelKey);

      if (update.reason === "Present") {
        if (existing) {
          await ctx.db.delete(existing._id);
        }

        continue;
      }

      if (existing) {
        if (
          existing.reason !== update.reason ||
          (existing.remarks ?? undefined) !== update.remarks
        ) {
          await ctx.db.patch(existing._id, {
            reason: update.reason,
            remarks: update.remarks,
            updatedAt: now,
          });
        }

        continue;
      }

      await ctx.db.insert("conductAttendanceEntries", {
        conductId: conduct._id,
        personnelKey: update.personnelKey,
        rank: update.person.rank,
        name: update.person.name,
        platoon: update.person.platoon,
        reason: update.reason,
        remarks: update.remarks,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (conduct.attendanceInitializedAt === undefined) {
      await ctx.db.patch(conduct._id, {
        attendanceInitializedAt: now,
      });
    }

    const latestEntries = await getEffectiveAttendanceEntriesForConduct(
      ctx,
      conduct._id,
    );

    return buildAttendanceSummary(snapshotRows, latestEntries);
  },
});

export const getConductWhatsappMessage = query({
  args: {
    conductId: v.id("conducts"),
  },
  handler: async (ctx, args) => {
    await ensureCurrentUser(ctx, {
      requireApproved: true,
      requirePermission: "conducts.view",
    });

    const conduct = await ctx.db.get(args.conductId);

    if (!conduct) {
      throw new ConvexError("The selected conduct no longer exists.");
    }

    const snapshotRows = await getSnapshotRowsForDate(ctx, conduct.date, conduct.conductDay);
    const attendanceEntries = await getEffectiveAttendanceEntriesForConduct(
      ctx,
      conduct._id,
    );
    const hasAttendance =
      conduct.attendanceInitializedAt !== undefined || attendanceEntries.length > 0;

    if (snapshotRows.length === 0 || !hasAttendance) {
      throw new ConvexError(
        "Attendance has not been initialized yet, so the WhatsApp message is unavailable.",
      );
    }

    const data = buildConductWhatsappData({
      conductName: conduct.name,
      date: conduct.date,
      snapshot: snapshotRows,
      absentees: attendanceEntries,
    });

    return {
      message: formatConductWhatsappMessage(data),
    };
  },
});

export const listConductsForTrackrCreate = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await ensureCurrentUser(ctx, {
      requireApproved: true,
      requirePermission: "conducts.manage",
    });

    return await ctx.db
      .query("conducts")
      .withIndex("by_createdAt")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
