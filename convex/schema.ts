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

  dutyAssignments: defineTable({
    personnelKey: v.string(),
    rank: v.string(),
    name: v.string(),
    platoon: v.string(),
    designation: v.string(),
    dutyType: v.string(),
    dutyTypeNormalized: v.string(),
    dutyPreset: v.union(
      v.literal("DOO"),
      v.literal("CDS"),
      v.literal("COS"),
      v.null(),
    ),
    dateOfDuty: v.string(),
    dutyDay: v.number(),
    points: v.number(),
    isExtra: v.boolean(),
    createdByName: v.string(),
    createdByEmail: v.string(),
    createdByAuthUserId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_dutyDay", ["dutyDay"])
    .index("by_dateOfDuty_and_personnelKey_and_dutyTypeNormalized", [
      "dateOfDuty",
      "personnelKey",
      "dutyTypeNormalized",
    ]),
});
