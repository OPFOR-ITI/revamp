import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import { statusValidator } from "./statusValidator";

export default defineSchema({
  appUsers: defineTable({
    authUserId: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("admin"), v.literal("operator")),
    approvalStatus: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    approvedByAuthUserId: v.optional(v.string()),
    approvedAt: v.optional(v.number()),
    rejectedByAuthUserId: v.optional(v.string()),
    rejectedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_approvalStatus", ["approvalStatus"]),

  paradeStateRecords: defineTable({
    personnelKey: v.string(),
    rank: v.string(),
    name: v.string(),
    platoon: v.string(),
    designation: v.string(),
    status: statusValidator,
    customStatus: v.optional(v.string()),
    affectParadeState: v.boolean(),
    startDate: v.string(),
    endDate: v.string(),
    startDay: v.number(),
    endDay: v.number(),
    remarks: v.optional(v.string()),
    submittedByName: v.string(),
    submittedByEmail: v.string(),
    submittedByAuthUserId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_personnelKey", ["personnelKey"])
    .index("by_endDay", ["endDay"])
    .index("by_createdAt", ["createdAt"])
    .index("by_status", ["status"]),
});
