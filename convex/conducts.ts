import { ConvexError, v } from "convex/values";

import {
  CONDUCT_ELIGIBLE_PLATOON_ORDER,
  buildConductWhatsappData,
  formatConductWhatsappMessage,
  isConductEligiblePlatoon,
} from "../src/lib/conduct-whatsapp";
import {
  dateStringToDayIndex,
  getTodaySingaporeDayIndex,
  isValidDateString,
} from "../src/lib/date";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { ensureCurrentUser } from "./users";

const nominalRollSeedItemValidator = v.object({
  personnelKey: v.string(),
  rank: v.string(),
  name: v.string(),
  platoon: v.string(),
});

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

function sortConductsDescending<T extends { createdAt: number }>(left: T, right: T) {
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

async function getAbsenteeRowsForConduct(
  ctx: QueryCtx | MutationCtx,
  conductId: Id<"conducts">,
) {
  const rows = await ctx.db
    .query("conductAbsentees")
    .withIndex("by_conductId", (q) => q.eq("conductId", conductId))
    .collect();

  return rows.filter((row) => isConductEligiblePlatoon(row.platoon));
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

  if (day !== getTodaySingaporeDayIndex()) {
    if (day > getTodaySingaporeDayIndex()) {
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
        const absentees = await getAbsenteeRowsForConduct(ctx, conduct._id);
        const absenteeCount = absentees.length;
        const whatsappData =
          conduct.attendanceInitializedAt !== undefined && snapshotExists
            ? buildConductWhatsappData({
                conductName: conduct.name,
                date: conduct.date,
                snapshot: snapshotRows,
                absentees,
              })
            : null;

        return {
          ...conduct,
          absenteeCount,
          participantCount:
            conduct.attendanceInitializedAt !== undefined && snapshotExists
              ? nominalRollCount - absenteeCount
              : null,
          nominalRollCount: snapshotExists ? nominalRollCount : null,
          snapshotStatus,
          hasAttendance: conduct.attendanceInitializedAt !== undefined,
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

export const getConductAttendanceState = query({
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
    const absentees = await getAbsenteeRowsForConduct(ctx, conduct._id);
    const platoonOptions = CONDUCT_ELIGIBLE_PLATOON_ORDER.filter((platoon) =>
      snapshotRows.length > 0 ? snapshotRows.some((row) => row.platoon === platoon) : true,
    );

    return {
      conduct,
      snapshotStatus: resolveConductSnapshotStatus(conduct.date, snapshotRows.length > 0),
      platoonOptions,
      snapshotRows,
      absenteePersonnelKeys: absentees.map((row) => row.personnelKey),
      attendanceInitialized: conduct.attendanceInitializedAt !== undefined,
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

    if (isDateChanging && existing.attendanceInitializedAt !== undefined) {
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

    const absentees = await getAbsenteeRowsForConduct(ctx, conduct._id);

    for (const absentee of absentees) {
      await ctx.db.delete(absentee._id);
    }

    await ctx.db.delete(conduct._id);

    return { deleted: true };
  },
});

export const setConductAbsentees = mutation({
  args: {
    conductId: v.id("conducts"),
    absenteePersonnelKeys: v.array(v.string()),
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
    const nextKeys = Array.from(
      new Set(args.absenteePersonnelKeys.map((value) => normalizeText(value)).filter(Boolean)),
    );

    for (const key of nextKeys) {
      if (!snapshotByKey.has(key)) {
        throw new ConvexError("All selected absentees must belong to the conduct snapshot.");
      }
    }

    const existingRows = await getAbsenteeRowsForConduct(ctx, conduct._id);
    const existingByKey = new Map(
      existingRows.map((row) => [row.personnelKey, row] as const),
    );
    const nextKeySet = new Set(nextKeys);
    const now = Date.now();

    for (const row of existingRows) {
      if (!nextKeySet.has(row.personnelKey)) {
        await ctx.db.delete(row._id);
      }
    }

    for (const key of nextKeys) {
      if (existingByKey.has(key)) {
        continue;
      }

      const person = snapshotByKey.get(key);

      if (!person) {
        continue;
      }

      await ctx.db.insert("conductAbsentees", {
        conductId: conduct._id,
        personnelKey: person.personnelKey,
        rank: person.rank,
        name: person.name,
        platoon: person.platoon,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (conduct.attendanceInitializedAt === undefined) {
      await ctx.db.patch(conduct._id, {
        attendanceInitializedAt: now,
      });
    }

    return {
      absenteeCount: nextKeys.length,
      participantCount: snapshotRows.length - nextKeys.length,
      nominalRollCount: snapshotRows.length,
    };
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

    if (snapshotRows.length === 0 || conduct.attendanceInitializedAt === undefined) {
      throw new ConvexError(
        "Attendance has not been initialized yet, so the WhatsApp message is unavailable.",
      );
    }

    const absentees = await getAbsenteeRowsForConduct(ctx, conduct._id);
    const data = buildConductWhatsappData({
      conductName: conduct.name,
      date: conduct.date,
      snapshot: snapshotRows,
      absentees,
    });

    return {
      message: formatConductWhatsappMessage(data),
    };
  },
});
