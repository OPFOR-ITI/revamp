import { NextResponse } from "next/server";
import { z } from "zod";

import { createTrackrClient, TrackrError } from "@/lib/trackr";

export const runtime = "nodejs";

const trackrHaCurrencyRequestSchema = z.object({
  cookie: z.string().trim().min(1, "Enter your Trackr browser cookie."),
});

const trackrHaCurrencyParamsSchema = z.object({
  unitId: z.string().uuid("Trackr unitId must be a valid UUID."),
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
  { params }: { params: Promise<{ unitId: string }> },
) {
  try {
    const json = await request.json();
    const parsedRequest = trackrHaCurrencyRequestSchema.parse(json);
    const parsedParams = trackrHaCurrencyParamsSchema.parse(await params);
    const trackr = createTrackrClient({
      cookie: parsedRequest.cookie,
    });
    const response = await trackr.getHaCurrencyUnit(parsedParams.unitId);

    return noStoreJson(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return noStoreJson(
        {
          error: {
            code: "TRACKR_HA_CURRENCY_REQUEST_INVALID",
            message:
              error.issues[0]?.message ?? "Invalid Trackr HA currency request.",
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

    console.error("Unexpected /api/trackr/currencies/ha/units error", error);

    return noStoreJson(
      {
        error: {
          code: "TRACKR_HA_CURRENCY_UNEXPECTED",
          message: "Unexpected error while loading Trackr HA currency.",
        },
      },
      500,
    );
  }
}
