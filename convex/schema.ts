import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import { statusValidator } from "./statusValidator";

export default defineSchema({
  appUsers: defineTable({
    authUserId: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.optional(v.union(v.literal("admin"), v.literal("operator"))),
    roles: v.optional(
      v.array(
        v.union(
          v.literal("admin"),
          v.literal("operator"),
          v.literal("dutyAdmin"),
        ),
      ),
    ),
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
    isPermanent: v.optional(v.boolean()),
    affectParadeState: v.boolean(),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    startDay: v.number(),
    endDay: v.optional(v.number()),
    remarks: v.optional(v.string()),
    submittedByName: v.string(),
    submittedByEmail: v.string(),
    submittedByAuthUserId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_personnelKey", ["personnelKey"])
    .index("by_isPermanent", ["isPermanent"])
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
      v.literal("CDO"),
      v.literal("DOO"),
      v.literal("CDS"),
      v.literal("COS"),
      v.literal("COS RESERVE"),
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
