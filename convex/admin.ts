import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { ensureCurrentUser } from "./users";

export const listPendingUsers = query({
  args: {},
  handler: async (ctx) => {
    await ensureCurrentUser(ctx, { requireApproved: true, requireAdmin: true });

    const users = await ctx.db
      .query("appUsers")
      .withIndex("by_approvalStatus", (q) => q.eq("approvalStatus", "pending"))
      .collect();

    return users.sort((left, right) => left.createdAt - right.createdAt);
  },
});

export const approveUser = mutation({
  args: {
    appUserId: v.id("appUsers"),
  },
  handler: async (ctx, args) => {
    const { appUser: actingUser } = await ensureCurrentUser(ctx, {
      requireApproved: true,
      requireAdmin: true,
    });
    const targetUser = await ctx.db.get(args.appUserId);

    if (!targetUser) {
      throw new ConvexError("The requested user no longer exists.");
    }

    const now = Date.now();
    await ctx.db.patch(args.appUserId, {
      approvalStatus: "approved",
      approvedAt: now,
      approvedByAuthUserId: actingUser.authUserId,
      rejectedAt: undefined,
      rejectedByAuthUserId: undefined,
      updatedAt: now,
    });
  },
});

export const rejectUser = mutation({
  args: {
    appUserId: v.id("appUsers"),
  },
  handler: async (ctx, args) => {
    const { appUser: actingUser } = await ensureCurrentUser(ctx, {
      requireApproved: true,
      requireAdmin: true,
    });
    const targetUser = await ctx.db.get(args.appUserId);

    if (!targetUser) {
      throw new ConvexError("The requested user no longer exists.");
    }

    if (targetUser.role === "admin") {
      throw new ConvexError("Admin users cannot be rejected from this screen.");
    }

    const now = Date.now();
    await ctx.db.patch(args.appUserId, {
      approvalStatus: "rejected",
      rejectedAt: now,
      rejectedByAuthUserId: actingUser.authUserId,
      approvedAt: undefined,
      approvedByAuthUserId: undefined,
      updatedAt: now,
    });
  },
});
