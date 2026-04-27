import { ConvexError } from "convex/values";
import type {
  MutationCtx,
  QueryCtx,
} from "./_generated/server";
import { mutation, query } from "./_generated/server";

import { authComponent } from "./auth";

type AnyUserCtx = MutationCtx | QueryCtx;

type EnsureCurrentUserOptions = {
  requireApproved?: boolean;
  requireAdmin?: boolean;
};

export async function ensureCurrentUser(
  ctx: AnyUserCtx,
  options: EnsureCurrentUserOptions = {},
) {
  const authUser = await authComponent.getAuthUser(ctx);
  const appUser = await ctx.db
    .query("appUsers")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUser._id))
    .unique();

  if (!appUser) {
    throw new ConvexError(
      "No application user profile exists for this account. Sign out and sign in again.",
    );
  }

  if (options.requireApproved && appUser.approvalStatus !== "approved") {
    throw new ConvexError("Your account is not approved for operations access.");
  }

  if (options.requireAdmin && appUser.role !== "admin") {
    throw new ConvexError("Admin access is required for this action.");
  }

  return { authUser, appUser };
}

export const syncCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.getAuthUser(ctx);
    const now = Date.now();
    const existing = await ctx.db
      .query("appUsers")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authUser._id))
      .unique();

    const name = authUser.name?.trim() || existing?.name || authUser.email;
    const email = authUser.email;

    if (existing) {
      await ctx.db.patch(existing._id, {
        name,
        email,
        updatedAt: now,
      });

      return {
        ...existing,
        name,
        email,
        updatedAt: now,
      };
    }

    const appUserId = await ctx.db.insert("appUsers", {
      authUserId: authUser._id,
      email,
      name,
      role: "operator",
      approvalStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(appUserId);
  },
});

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const { appUser, authUser } = await ensureCurrentUser(ctx);

    return {
      ...appUser,
      authEmail: authUser.email,
      authName: authUser.name,
    };
  },
});
