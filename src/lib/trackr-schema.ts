import { z } from "zod";

const TRACKR_OPFOR_UNIT_NAME_PATTERN = /\bOPFOR\b/i;

const trackrMixedIdSchema = z.union([z.string(), z.number()]);

export const trackrUnitSchema = z.object({
  id: z.string().uuid("Trackr unit id must be a valid UUID."),
  name: z.string(),
});

export const trackrCategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  isHa: z.boolean(),
});

export const trackrActivitySchema = z.object({
  id: z.string().uuid("Trackr activity id must be a valid UUID."),
  date: z.string(),
  name: z.string(),
  conductingUnit: trackrUnitSchema,
  category: trackrCategorySchema,
  description: z.string().nullable(),
  participatingUnits: z.array(trackrUnitSchema),
  periods: z.number(),
});

export const trackrActivitiesResponseSchema = z.object({
  activities: z.array(trackrActivitySchema),
});

export const trackrActivitiesFetchResponseSchema = z.object({
  fetchedCount: z.number().int().nonnegative(),
  ignoredCount: z.number().int().nonnegative(),
  activities: z.array(trackrActivitySchema),
});

export const trackrCreateActivityItemSchema = z.object({
  name: z.string().trim().min(1),
  periods: z.number().int().min(1),
  date: z.string(),
  conductingUnitId: z.string().uuid(),
  description: z.string().nullable(),
  categoryId: z.number().int(),
});

export const trackrCreateActivitiesPayloadSchema = z.object({
  activities: z.array(trackrCreateActivityItemSchema).min(1),
});

export const trackrCreateActivitiesResponseSchema = z.object({
  message: z.string(),
  activityIds: z.array(z.string().uuid()),
});

export const trackrHaCurrencyStatsSchema = z.object({
  numCurrent: z.number().int().nonnegative(),
  numExpiringSoon: z.number().int().nonnegative(),
  numExpired: z.number().int().nonnegative(),
  numNotSubscribed: z.number().int().nonnegative(),
});

export const trackrHaCurrencyUserSchema = z
  .object({
    id: z.string().uuid("Trackr user id must be a valid UUID."),
    name: z.string(),
    unitName: z.string(),
    status: z.string(),
    daysToExpiry: z.number().int().nullable(),
    expiryDate: z.string().nullable(),
    doubleHaEligibleDate: z.string().nullable(),
  })
  .passthrough();

export const trackrHaCurrencyUnitResponseSchema = z.object({
  unitName: z.string(),
  stats: trackrHaCurrencyStatsSchema,
  users: z.array(trackrHaCurrencyUserSchema),
});

export const trackrHaCurrencyRecommendationDetailSchema = z
  .object({
    detector: z.string(),
    daysRemaining: z.number().int().nullable().optional(),
    periodsRemaining: z.number().int().nullable().optional(),
    breakDaysRemaining: z.number().int().nullable().optional(),
    maxConsecutiveBreakDays: z.number().int().nullable().optional(),
    startDate: z.string().nullable().optional(),
    earliestEndDate: z.string().nullable().optional(),
    latestEndDate: z.string().nullable().optional(),
    validPeriodsWindow: z.array(z.number().int()).optional(),
  })
  .passthrough();

export const trackrHaCurrencyUserDetailResponseSchema = z
  .object({
    user: z
      .object({
        id: z.string().uuid("Trackr user id must be a valid UUID."),
        name: z.string(),
        enlistmentDate: z.string().nullable().optional(),
        systemName: z.string().nullable().optional(),
      })
      .passthrough(),
    doubleHaEligibleDate: z.string().nullable().optional(),
    awardedDate: z.string().nullable().optional(),
    qualifyingProgramme: z.string().nullable().optional(),
    expiryDate: z.string().nullable().optional(),
    recommendations: z
      .object({
        type: z.string().optional(),
        recommendationDetails: z.array(trackrHaCurrencyRecommendationDetailSchema),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export const trackrUserActivitySchema = z
  .object({
    id: z.string().uuid("Trackr activity id must be a valid UUID."),
    date: z.string(),
    name: z.string(),
    category: trackrCategorySchema,
    description: z.string().nullable(),
    conductingUnit: trackrUnitSchema,
    periods: z.number(),
    attendanceStatus: z
      .object({
        id: trackrMixedIdSchema,
        name: z.string(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const trackrUserActivitiesResponseSchema = z.object({
  activities: z.array(trackrUserActivitySchema),
});

export const trackrUsersQueryPayloadSchema = z.object({
  unitIds: z
    .array(z.string().uuid("Each Trackr unitId must be a valid UUID."))
    .min(1, "At least one Trackr unitId is required."),
});

export const trackrUserSchema = z.object({
  id: z.string().uuid("Trackr user id must be a valid UUID."),
  name: z.string(),
  units: z.array(trackrUnitSchema),
});

export const trackrUsersQueryResponseSchema = z.object({
  users: z.array(trackrUserSchema),
});

export const trackrStatusSchema = z
  .object({
    id: trackrMixedIdSchema,
    name: z.string(),
  })
  .passthrough();

export const trackrStatusesResponseSchema = z
  .union([
    z.object({ statuses: z.array(trackrStatusSchema) }).passthrough(),
    z.array(trackrStatusSchema),
  ])
  .transform((value) => ({
    statuses: Array.isArray(value) ? value : value.statuses,
  }));

export const trackrAttendanceUserAddPayloadSchema = z.object({
  activityId: z.string().uuid("Trackr activityId must be a valid UUID."),
  userIds: z
    .array(z.string().uuid("Each Trackr userId must be a valid UUID."))
    .min(1, "At least one Trackr userId is required."),
});

const trackrAttendanceStatusReferenceSchema = z
  .object({
    id: trackrMixedIdSchema.optional(),
    name: z.string().optional(),
  })
  .passthrough();

const trackrAttendanceUserReferenceSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().optional(),
  })
  .passthrough();

export const trackrActivityAttendanceRowSchema = z
  .object({
    id: trackrMixedIdSchema.optional(),
    attendanceId: trackrMixedIdSchema.optional(),
    userId: z.string().uuid().optional(),
    name: z.string().optional(),
    remarks: z.string().nullable().optional(),
    statusId: trackrMixedIdSchema.optional(),
    status: z.union([trackrAttendanceStatusReferenceSchema, z.string()]).optional(),
    user: trackrAttendanceUserReferenceSchema.optional(),
  })
  .passthrough();

export const trackrActivityAttendanceResponseSchema = z
  .union([
    z.object({ attendances: z.array(trackrActivityAttendanceRowSchema) }).passthrough(),
    z.object({ attendance: z.array(trackrActivityAttendanceRowSchema) }).passthrough(),
    z.object({ users: z.array(trackrActivityAttendanceRowSchema) }).passthrough(),
    z.object({ data: z.array(trackrActivityAttendanceRowSchema) }).passthrough(),
    z.array(trackrActivityAttendanceRowSchema),
  ])
  .transform((value) => {
    if (Array.isArray(value)) {
      return { attendances: value };
    }

    return {
      attendances:
        value.attendances ??
        ("attendance" in value ? value.attendance : undefined) ??
        ("users" in value ? value.users : undefined) ??
        ("data" in value ? value.data : undefined) ??
        [],
    };
  });

export const trackrAttendancePatchItemSchema = z
  .object({
    attendanceId: trackrMixedIdSchema,
    statusId: trackrMixedIdSchema,
    remarks: z.string().trim().min(1).optional(),
  })
  .passthrough();

export const trackrAttendancePatchPayloadSchema = z
  .object({
    activityId: z.string().uuid("Trackr activityId must be a valid UUID."),
    attendances: z
      .array(trackrAttendancePatchItemSchema)
      .min(1, "At least one Trackr attendance update is required."),
  })
  .passthrough();

export type TrackrMixedId = z.infer<typeof trackrMixedIdSchema>;
export type TrackrUnit = z.infer<typeof trackrUnitSchema>;
export type TrackrCategory = z.infer<typeof trackrCategorySchema>;
export type TrackrActivity = z.infer<typeof trackrActivitySchema>;
export type TrackrActivitiesResponse = z.infer<
  typeof trackrActivitiesResponseSchema
>;
export type TrackrActivitiesFetchResponse = z.infer<
  typeof trackrActivitiesFetchResponseSchema
>;
export type TrackrCreateActivityItem = z.infer<
  typeof trackrCreateActivityItemSchema
>;
export type TrackrCreateActivitiesPayload = z.infer<
  typeof trackrCreateActivitiesPayloadSchema
>;
export type TrackrCreateActivitiesResponse = z.infer<
  typeof trackrCreateActivitiesResponseSchema
>;
export type TrackrHaCurrencyStats = z.infer<
  typeof trackrHaCurrencyStatsSchema
>;
export type TrackrHaCurrencyUser = z.infer<typeof trackrHaCurrencyUserSchema>;
export type TrackrHaCurrencyUnitResponse = z.infer<
  typeof trackrHaCurrencyUnitResponseSchema
>;
export type TrackrHaCurrencyRecommendationDetail = z.infer<
  typeof trackrHaCurrencyRecommendationDetailSchema
>;
export type TrackrHaCurrencyUserDetailResponse = z.infer<
  typeof trackrHaCurrencyUserDetailResponseSchema
>;
export type TrackrUserActivity = z.infer<typeof trackrUserActivitySchema>;
export type TrackrUserActivitiesResponse = z.infer<
  typeof trackrUserActivitiesResponseSchema
>;
export type TrackrUsersQueryPayload = z.infer<
  typeof trackrUsersQueryPayloadSchema
>;
export type TrackrUser = z.infer<typeof trackrUserSchema>;
export type TrackrUsersQueryResponse = z.infer<
  typeof trackrUsersQueryResponseSchema
>;
export type TrackrStatus = z.infer<typeof trackrStatusSchema>;
export type TrackrStatusesResponse = z.infer<
  typeof trackrStatusesResponseSchema
>;
export type TrackrAttendanceUserAddPayload = z.infer<
  typeof trackrAttendanceUserAddPayloadSchema
>;
export type TrackrActivityAttendanceRow = z.infer<
  typeof trackrActivityAttendanceRowSchema
>;
export type TrackrActivityAttendanceResponse = z.infer<
  typeof trackrActivityAttendanceResponseSchema
>;
export type TrackrAttendancePatchItem = z.infer<
  typeof trackrAttendancePatchItemSchema
>;
export type TrackrAttendancePatchPayload = z.infer<
  typeof trackrAttendancePatchPayloadSchema
>;

export function isTrackrOpforUnitName(value: string) {
  return TRACKR_OPFOR_UNIT_NAME_PATTERN.test(value);
}

export function isTrackrOpforActivity(activity: TrackrActivity) {
  return isTrackrOpforUnitName(activity.conductingUnit.name);
}
