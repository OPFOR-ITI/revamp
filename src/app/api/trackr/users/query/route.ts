import { NextResponse } from "next/server";
import { z } from "zod";

import {
  trackrUsersQueryPayloadSchema,
} from "@/lib/trackr-schema";
import { createTrackrClient, TrackrError } from "@/lib/trackr";

export const runtime = "nodejs";

const trackrUsersQueryRequestSchema = z.object({
  cookie: z.string().trim().min(1, "Enter your Trackr browser cookie."),
  payload: trackrUsersQueryPayloadSchema,
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
    const parsedRequest = trackrUsersQueryRequestSchema.parse(json);
    const trackr = createTrackrClient({
      cookie: parsedRequest.cookie,
    });
    const response = await trackr.queryUsers(parsedRequest.payload);

    return noStoreJson(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return noStoreJson(
        {
          error: {
            code: "TRACKR_USERS_QUERY_REQUEST_INVALID",
            message:
              error.issues[0]?.message ?? "Invalid Trackr users query request.",
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

    console.error("Unexpected /api/trackr/users/query error", error);

    return noStoreJson(
      {
        error: {
          code: "TRACKR_USERS_QUERY_UNEXPECTED",
          message: "Unexpected error while loading Trackr users.",
        },
      },
      500,
    );
  }
}
