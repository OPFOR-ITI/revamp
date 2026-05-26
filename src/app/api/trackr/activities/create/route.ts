import { NextResponse } from "next/server";
import { z } from "zod";

import {
  trackrCreateActivitiesPayloadSchema,
  trackrCreateActivitiesResponseSchema,
} from "@/lib/trackr-schema";
import { getTrackrAttendanceUnitsFromTrees } from "@/lib/trackr-config";
import { createTrackrClient, TrackrError } from "@/lib/trackr";

export const runtime = "nodejs";

const trackrCreateActivitiesRequestSchema = z.object({
  cookie: z.string().trim().min(1, "Enter your Trackr browser cookie."),
  payload: trackrCreateActivitiesPayloadSchema,
});

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function addAllAttendanceUsersForActivity(
  trackr: ReturnType<typeof createTrackrClient>,
  activityId: string,
) {
  const unitTreesResponse = await trackr.getAttendanceUnitTrees(activityId);
  const units = getTrackrAttendanceUnitsFromTrees(unitTreesResponse);

  if (units.length === 0) {
    throw new TrackrError(
      "TRACKR_CREATE_ACTIVITY_UNITS_EMPTY",
      "No Trackr attendance units were found for the created activity.",
    );
  }

  const usersResponse = await trackr.queryUsers({
    unitIds: units.map((unit) => unit.id),
  });
  const userIds = usersResponse.users.map((user) => user.id);

  if (userIds.length === 0) {
    return {
      activityId,
      unitCount: units.length,
      userCount: 0,
    };
  }

  await trackr.addAttendanceUsers({
    activityId,
    userIds,
  });

  return {
    activityId,
    unitCount: units.length,
    userCount: userIds.length,
  };
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsedRequest = trackrCreateActivitiesRequestSchema.parse(json);
    const trackr = createTrackrClient({
      cookie: parsedRequest.cookie,
    });
    const response = await trackr.createActivities(parsedRequest.payload);
    const parsedResponse = trackrCreateActivitiesResponseSchema.parse(response);
    const attendanceSeeds = await Promise.all(
      parsedResponse.activityIds.map((activityId) =>
        addAllAttendanceUsersForActivity(trackr, activityId),
      ),
    );

    return noStoreJson({
      ...parsedResponse,
      attendanceSeeds,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return noStoreJson(
        {
          error: {
            code: "TRACKR_CREATE_ACTIVITY_REQUEST_INVALID",
            message:
              error.issues[0]?.message ?? "Invalid Trackr activity create request.",
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

    console.error("Unexpected /api/trackr/activities/create error", error);

    return noStoreJson(
      {
        error: {
          code: "TRACKR_CREATE_ACTIVITY_UNEXPECTED",
          message: "Unexpected error while creating a Trackr activity.",
        },
      },
      500,
    );
  }
}
