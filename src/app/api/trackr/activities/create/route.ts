import { NextResponse } from "next/server";
import { z } from "zod";

import {
  trackrCreateActivitiesPayloadSchema,
  trackrCreateActivitiesResponseSchema,
} from "@/lib/trackr-schema";
import { createTrackrClient, TrackrError } from "@/lib/trackr";

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

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsedRequest = trackrCreateActivitiesRequestSchema.parse(json);
    const trackr = createTrackrClient({
      cookie: parsedRequest.cookie,
    });
    const response = await trackr.createActivities(parsedRequest.payload);

    return noStoreJson(trackrCreateActivitiesResponseSchema.parse(response));
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
