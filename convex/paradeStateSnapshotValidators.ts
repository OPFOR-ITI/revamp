import { v } from "convex/values";

import { statusValidator } from "./statusValidator";

export const paradeStateSnapshotPersonnelValidator = v.object({
  personnelKey: v.string(),
  rank: v.string(),
  name: v.string(),
  platoon: v.string(),
  designation: v.string(),
  alias: v.optional(v.string()),
  label: v.string(),
});

export const paradeStateSnapshotRecordValidator = v.object({
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
  remarks: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const paradeStateSnapshotDutyAssignmentValidator = v.object({
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
  createdAt: v.number(),
  updatedAt: v.number(),
});
