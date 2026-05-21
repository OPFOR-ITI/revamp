import { NextResponse } from "next/server";
import { z } from "zod";

import { createTrackrClient, TrackrError } from "@/lib/trackr";
import { trackrUserActivitiesResponseSchema } from "@/lib/trackr-schema";

export const runtime = "nodejs";

const trackrUserActivitiesRequestSchema = z.object({
  cookie: z.string().trim().min(1, "Enter your Trackr browser cookie."),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid end date."),
});

const trackrUserActivitiesParamsSchema = z.object({
  userId: z.string().uuid("Trackr userId must be a valid UUID."),
});

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const json = await request.json();
    const parsedRequest = trackrUserActivitiesRequestSchema.parse(json);
    const parsedParams = trackrUserActivitiesParamsSchema.parse(await params);
    const trackr = createTrackrClient({
      cookie: parsedRequest.cookie,
    });
    const response = await trackr.listUserActivities(parsedParams.userId, {
      end: parsedRequest.end,
      metricKey: "ha",
      sortAscending: false,
    });

    return noStoreJson(trackrUserActivitiesResponseSchema.parse(response));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return noStoreJson(
        {
          error: {
            code: "TRACKR_USER_ACTIVITIES_REQUEST_INVALID",
            message:
              error.issues[0]?.message ??
              "Invalid Trackr user activities request.",
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

    console.error("Unexpected /api/trackr/activities/users error", error);

    return noStoreJson(
      {
        error: {
          code: "TRACKR_USER_ACTIVITIES_UNEXPECTED",
          message: "Unexpected error while loading Trackr user activities.",
        },
      },
      500,
    );
  }
}
