import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { normalizeAppUser, ensureCurrentUser } from "./users";

const userRoleValidator = v.union(
  v.literal("admin"),
  v.literal("operator"),
  v.literal("dutyAdmin"),
);

const approvalStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);

function getApprovalSortWeight(approvalStatus: "pending" | "approved" | "rejected") {
  switch (approvalStatus) {
    case "pending":
      return 0;
    case "approved":
      return 1;
    case "rejected":
      return 2;
  }
}

function sortUsers<
  T extends { approvalStatus: "pending" | "approved" | "rejected"; createdAt: number; name: string },
>(left: T, right: T) {
  return (
    getApprovalSortWeight(left.approvalStatus) -
      getApprovalSortWeight(right.approvalStatus) ||
    right.createdAt - left.createdAt ||
    left.name.localeCompare(right.name)
  );
}

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const { appUser: actingUser } = await ensureCurrentUser(ctx, {
      requireApproved: true,
      requirePermission: "userManagement.manage",
    });

    const users = await ctx.db
      .query("appUsers")
      .collect();

    return users
      .map((user) => ({
        ...normalizeAppUser(user),
        isCurrentUser: user._id === actingUser._id,
      }))
      .sort(sortUsers);
  },
});

export const updateUserAccess = mutation({
  args: {
    appUserId: v.id("appUsers"),
    roles: v.array(userRoleValidator),
    approvalStatus: approvalStatusValidator,
  },
  handler: async (ctx, args) => {
    const { appUser: actingUser } = await ensureCurrentUser(ctx, {
      requireApproved: true,
      requirePermission: "userManagement.manage",
    });
    const targetUser = await ctx.db.get(args.appUserId);

    if (!targetUser) {
      throw new ConvexError("The requested user no longer exists.");
    }

    if (targetUser._id === actingUser._id) {
      throw new ConvexError("You cannot change your own access from this screen.");
    }

    if (!args.roles.length) {
      throw new ConvexError("Assign at least one role.");
    }

    const now = Date.now();
    await ctx.db.patch(args.appUserId, {
      roles: args.roles,
      approvalStatus: args.approvalStatus,
      approvedAt:
        args.approvalStatus === "approved"
          ? targetUser.approvalStatus === "approved"
            ? targetUser.approvedAt
            : now
          : undefined,
      approvedByAuthUserId:
        args.approvalStatus === "approved"
          ? targetUser.approvalStatus === "approved"
            ? targetUser.approvedByAuthUserId
            : actingUser.authUserId
          : undefined,
      rejectedAt:
        args.approvalStatus === "rejected"
          ? targetUser.approvalStatus === "rejected"
            ? targetUser.rejectedAt
            : now
          : undefined,
      rejectedByAuthUserId:
        args.approvalStatus === "rejected"
          ? targetUser.approvalStatus === "rejected"
            ? targetUser.rejectedByAuthUserId
            : actingUser.authUserId
          : undefined,
      updatedAt: now,
    });
  },
});
