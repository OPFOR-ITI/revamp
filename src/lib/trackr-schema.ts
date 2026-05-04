import { z } from "zod";

const TRACKR_OPFOR_UNIT_NAME_PATTERN = /\bOPFOR\b/i;

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

export const trackrAttendanceUnitsPayloadSchema = z.object({
  activityId: z.string().uuid("Trackr activityId must be a valid UUID."),
  unitIds: z
    .array(z.string().uuid("Each Trackr unitId must be a valid UUID."))
    .min(1, "At least one Trackr unitId is required."),
});

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
export type TrackrAttendanceUnitsPayload = z.infer<
  typeof trackrAttendanceUnitsPayloadSchema
>;

export function isTrackrOpforUnitName(value: string) {
  return TRACKR_OPFOR_UNIT_NAME_PATTERN.test(value);
}

export function isTrackrOpforActivity(activity: TrackrActivity) {
  return isTrackrOpforUnitName(activity.conductingUnit.name);
}
