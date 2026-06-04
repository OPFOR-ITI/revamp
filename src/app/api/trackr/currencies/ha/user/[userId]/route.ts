import { NextResponse } from "next/server";
import { z } from "zod";

import { createTrackrClient, TrackrError } from "@/lib/trackr";

export const runtime = "nodejs";

const trackrHaCurrencyUserRequestSchema = z.object({
  cookie: z.string().trim().min(1, "Enter your Trackr browser cookie."),
});

const trackrHaCurrencyUserParamsSchema = z.object({
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
    const parsedRequest = trackrHaCurrencyUserRequestSchema.parse(json);
    const parsedParams = trackrHaCurrencyUserParamsSchema.parse(await params);
    const trackr = createTrackrClient({
      cookie: parsedRequest.cookie,
    });
    const response = await trackr.getHaCurrencyUser(parsedParams.userId);

    return noStoreJson(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return noStoreJson(
        {
          error: {
            code: "TRACKR_HA_CURRENCY_USER_REQUEST_INVALID",
            message:
              error.issues[0]?.message ??
              "Invalid Trackr HA currency user request.",
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

    console.error("Unexpected /api/trackr/currencies/ha/user error", error);

    return noStoreJson(
      {
        error: {
          code: "TRACKR_HA_CURRENCY_USER_UNEXPECTED",
          message: "Unexpected error while loading Trackr HA currency user.",
        },
      },
      500,
    );
  }
}
