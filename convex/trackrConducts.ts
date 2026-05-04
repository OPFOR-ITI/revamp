import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

import {
  dateStringToDayIndex,
  isValidDateString,
} from "../src/lib/date";
import {
  type TrackrActivity,
  isTrackrOpforActivity,
} from "../src/lib/trackr-schema";
import { mutation, query } from "./_generated/server";
import { ensureCurrentUser } from "./users";

const trackrActivityImportValidator = v.object({
  id: v.string(),
  date: v.string(),
  name: v.string(),
  conductingUnit: v.object({
    id: v.string(),
    name: v.string(),
  }),
  category: v.object({
    id: v.number(),
    name: v.string(),
    isHa: v.boolean(),
  }),
  description: v.union(v.string(), v.null()),
  participatingUnits: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
    }),
  ),
  periods: v.number(),
});

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeTrackrDate(value: string) {
  const date = value.trim().slice(0, 10);

  if (!isValidDateString(date)) {
    throw new ConvexError(
      'Trackr activity date must contain a valid "YYYY-MM-DD" prefix.',
    );
  }

  return date;
}

function normalizeTrackrActivity(activity: TrackrActivity) {
  const name = normalizeText(activity.name);
  const trackrActivityId = normalizeText(activity.id);
  const conductingUnitName = normalizeText(activity.conductingUnit.name);
  const conductingUnitId = normalizeText(activity.conductingUnit.id);
  const date = normalizeTrackrDate(activity.date);

  if (!name || !trackrActivityId || !conductingUnitName || !conductingUnitId) {
    throw new ConvexError("Trackr activity details were incomplete.");
  }

  return {
    name,
    trackrActivityId,
    date,
    conductDay: dateStringToDayIndex(date),
    conductingUnitName,
    conductingUnitId,
  };
}

export const importTrackrConducts = mutation({
  args: {
    activities: v.array(trackrActivityImportValidator),
  },
  handler: async (ctx, args) => {
    await ensureCurrentUser(ctx, {
      requireApproved: true,
      requirePermission: "conducts.manage",
    });

    const now = Date.now();
    let insertedCount = 0;
    let updatedCount = 0;

    for (const rawActivity of args.activities as TrackrActivity[]) {
      if (!isTrackrOpforActivity(rawActivity)) {
        continue;
      }

      const activity = normalizeTrackrActivity(rawActivity);
      const existing = await ctx.db
        .query("trackrConducts")
        .withIndex("by_trackrActivityId", (q) =>
          q.eq("trackrActivityId", activity.trackrActivityId),
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          name: activity.name,
          date: activity.date,
          conductDay: activity.conductDay,
          conductingUnitName: activity.conductingUnitName,
          conductingUnitId: activity.conductingUnitId,
          updatedAt: now,
        });
        updatedCount += 1;
        continue;
      }

      await ctx.db.insert("trackrConducts", {
        ...activity,
        createdAt: now,
        updatedAt: now,
      });
      insertedCount += 1;
    }

    return {
      importedCount: insertedCount + updatedCount,
      insertedCount,
      updatedCount,
    };
  },
});

export const listTrackrConducts = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await ensureCurrentUser(ctx, {
      requireApproved: true,
      requirePermission: "conducts.manage",
    });

    return await ctx.db
      .query("trackrConducts")
      .withIndex("by_conductDay")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const upsertTrackrConductFromCreate = mutation({
  args: {
    name: v.string(),
    trackrActivityId: v.string(),
    date: v.string(),
    conductingUnitName: v.string(),
    conductingUnitId: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureCurrentUser(ctx, {
      requireApproved: true,
      requirePermission: "conducts.manage",
    });

    const name = normalizeText(args.name);
    const trackrActivityId = normalizeText(args.trackrActivityId);
    const conductingUnitName = normalizeText(args.conductingUnitName);
    const conductingUnitId = normalizeText(args.conductingUnitId);
    const date = normalizeTrackrDate(args.date);

    if (!name || !trackrActivityId || !conductingUnitName || !conductingUnitId) {
      throw new ConvexError("Trackr conduct details were incomplete.");
    }

    const conductDay = dateStringToDayIndex(date);
    const now = Date.now();
    const existing = await ctx.db
      .query("trackrConducts")
      .withIndex("by_trackrActivityId", (q) =>
        q.eq("trackrActivityId", trackrActivityId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name,
        date,
        conductDay,
        conductingUnitName,
        conductingUnitId,
        updatedAt: now,
      });

      return {
        trackrConductId: existing._id,
        created: false,
      };
    }

    const trackrConductId = await ctx.db.insert("trackrConducts", {
      name,
      trackrActivityId,
      date,
      conductDay,
      conductingUnitName,
      conductingUnitId,
      createdAt: now,
      updatedAt: now,
    });

    return {
      trackrConductId,
      created: true,
    };
  },
});
