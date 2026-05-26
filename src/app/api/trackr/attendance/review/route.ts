import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizeTrackrAttendanceRows } from "@/lib/trackr-attendance";
import { getTrackrAttendanceUnitsFromTrees } from "@/lib/trackr-config";
import { createTrackrClient, TrackrError } from "@/lib/trackr";
import type { TrackrActivityAttendanceRow } from "@/lib/trackr-schema";

export const runtime = "nodejs";

const trackrAttendanceReviewRequestSchema = z.object({
  cookie: z.string().trim().min(1, "Enter your Trackr browser cookie."),
  activityId: z.string().uuid("Select a valid Trackr activity."),
});

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsedRequest = trackrAttendanceReviewRequestSchema.parse(json);
    const trackr = createTrackrClient({
      cookie: parsedRequest.cookie,
    });
    const [unitTreesResponse, initialAttendanceResponse] = await Promise.all([
      trackr.getAttendanceUnitTrees(parsedRequest.activityId),
      trackr.getActivityAttendance(parsedRequest.activityId),
    ]);
    const reviewUnits = getTrackrAttendanceUnitsFromTrees(unitTreesResponse);

    if (reviewUnits.length === 0) {
      throw new TrackrError(
        "TRACKR_ATTENDANCE_REVIEW_UNITS_EMPTY",
        "No Trackr attendance units were found for this activity.",
      );
    }

    const usersResponse = await trackr.queryUsers({
      unitIds: reviewUnits.map((unit) => unit.id),
    });
    const existingAttendanceRows = normalizeTrackrAttendanceRows(
      initialAttendanceResponse.attendances as TrackrActivityAttendanceRow[],
    );
    const existingUserIds = new Set(
      existingAttendanceRows
        .map((row) => row.userId)
        .filter((userId): userId is string => Boolean(userId)),
    );
    const missingUserIds = usersResponse.users
      .map((user) => user.id)
      .filter((userId) => !existingUserIds.has(userId));

    if (missingUserIds.length > 0) {
      await trackr.addAttendanceUsers({
        activityId: parsedRequest.activityId,
        userIds: missingUserIds,
      });
    }

    const [statusesResponse, attendanceResponse] = await Promise.all([
      trackr.listStatuses(),
      missingUserIds.length > 0
        ? trackr.getActivityAttendance(parsedRequest.activityId)
        : Promise.resolve(initialAttendanceResponse),
    ]);

    return noStoreJson({
      activityId: parsedRequest.activityId,
      queriedUnitCount: reviewUnits.length,
      queriedUserCount: usersResponse.users.length,
      statuses: statusesResponse.statuses,
      attendanceRows: normalizeTrackrAttendanceRows(
        attendanceResponse.attendances as TrackrActivityAttendanceRow[],
      ),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return noStoreJson(
        {
          error: {
            code: "TRACKR_ATTENDANCE_REVIEW_REQUEST_INVALID",
            message:
              error.issues[0]?.message ??
              "Invalid Trackr attendance review request.",
          },
        },
        400,
      );
    }

    if (error instanceof TrackrError) {
      return noStoreJson(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        error.status,
      );
    }

    console.error("Unexpected /api/trackr/attendance/review error", error);

    return noStoreJson(
      {
        error: {
          code: "TRACKR_ATTENDANCE_REVIEW_UNEXPECTED",
          message: "Unexpected error while preparing Trackr attendance review.",
        },
      },
      500,
    );
  }
}
