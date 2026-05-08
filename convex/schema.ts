import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import {
  paradeStateSnapshotDutyAssignmentValidator,
  paradeStateSnapshotPersonnelValidator,
  paradeStateSnapshotRecordValidator,
} from "./paradeStateSnapshotValidators";
import { statusValidator } from "./statusValidator";

export default defineSchema({
  appUsers: defineTable({
    authUserId: v.string(),
    email: v.string(),
    name: v.string(),
    platoon: v.optional(
      v.union(
        v.literal("Coy HQ"),
        v.literal("Platoon 1"),
        v.literal("Platoon 2"),
        v.literal("Platoon 3"),
        v.literal("Mobile Platoon"),
        v.literal("Shark Platoon"),
      ),
    ),
    roles: v.array(
      v.union(
        v.literal("admin"),
        v.literal("operator"),
        v.literal("dutyAdmin"),
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
    searchText: v.optional(v.string()),
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
    .index("by_status", ["status"])
    .index("by_platoon_and_isPermanent", ["platoon", "isPermanent"])
    .index("by_platoon_and_endDay", ["platoon", "endDay"])
    .index("by_platoon_and_createdAt", ["platoon", "createdAt"])
    .index("by_status_and_createdAt", ["status", "createdAt"])
    .index("by_affectParadeState_and_createdAt", [
      "affectParadeState",
      "createdAt",
    ])
    .searchIndex("search_recordLog", {
      searchField: "searchText",
      filterFields: ["platoon", "status", "affectParadeState"],
    }),

  paradeStateSnapshots: defineTable({
    snapshotDate: v.string(),
    snapshotDay: v.number(),
    asAtTime: v.string(),
    personnel: v.array(paradeStateSnapshotPersonnelValidator),
    activeRecords: v.array(paradeStateSnapshotRecordValidator),
    dutyAssignments: v.array(paradeStateSnapshotDutyAssignmentValidator),
    savedByName: v.string(),
    savedByEmail: v.string(),
    savedByAuthUserId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_snapshotDate", ["snapshotDate"])
    .index("by_snapshotDay", ["snapshotDay"]),

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

  conducts: defineTable({
    name: v.string(),
    date: v.string(),
    conductDay: v.number(),
    numberOfPeriods: v.number(),
    description: v.optional(v.string()),
    attendanceInitializedAt: v.optional(v.number()),
    createdByName: v.string(),
    createdByEmail: v.string(),
    createdByAuthUserId: v.string(),
    updatedByName: v.string(),
    updatedByEmail: v.string(),
    updatedByAuthUserId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_conductDay", ["conductDay"])
    .index("by_createdAt", ["createdAt"]),

  conductNominalRollSnapshots: defineTable({
    snapshotDate: v.string(),
    snapshotDay: v.number(),
    personnelKey: v.string(),
    rank: v.string(),
    name: v.string(),
    platoon: v.string(),
    createdAt: v.number(),
  })
    .index("by_snapshotDay", ["snapshotDay"])
    .index("by_snapshotDate_and_personnelKey", ["snapshotDate", "personnelKey"]),

  conductAttendanceEntries: defineTable({
    conductId: v.id("conducts"),
    personnelKey: v.string(),
    rank: v.string(),
    name: v.string(),
    platoon: v.string(),
    reason: v.union(
      v.literal("MC"),
      v.literal("Leave"),
      v.literal("Off"),
      v.literal("Fall Out"),
      v.literal("Other"),
    ),
    remarks: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_conductId", ["conductId"])
    .index("by_conductId_and_personnelKey", ["conductId", "personnelKey"]),
});
