import { NextResponse } from "next/server";
import { z } from "zod";

import {
  isTrackrOpforActivity,
  trackrActivitiesFetchResponseSchema,
} from "@/lib/trackr-schema";
import {
  createTrackrClient,
  TrackrError,
} from "@/lib/trackr";

export const runtime = "nodejs";

const trackrActivitiesRequestSchema = z.object({
  cookie: z
    .string()
    .trim()
    .min(1, "Enter your Trackr browser cookie."),
  isPast: z.boolean().optional().default(true),
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
    const parsedRequest = trackrActivitiesRequestSchema.parse(json);
    const trackr = createTrackrClient({
      cookie: parsedRequest.cookie,
    });
    const response = await trackr.listActivities({
      isPast: parsedRequest.isPast,
    });
    const activities = response.activities.filter(isTrackrOpforActivity);

    return noStoreJson(
      trackrActivitiesFetchResponseSchema.parse({
        fetchedCount: response.activities.length,
        ignoredCount: response.activities.length - activities.length,
        activities,
      }),
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return noStoreJson(
        {
          error: {
            code: "TRACKR_ACTIVITIES_REQUEST_INVALID",
            message: error.issues[0]?.message ?? "Invalid Trackr request.",
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

    console.error("Unexpected /api/trackr/activities error", error);

    return noStoreJson(
      {
        error: {
          code: "TRACKR_ACTIVITIES_UNEXPECTED",
          message: "Unexpected error while loading Trackr activities.",
        },
      },
      500,
    );
  }
}
