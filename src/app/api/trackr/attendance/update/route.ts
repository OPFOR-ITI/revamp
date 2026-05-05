import { NextResponse } from "next/server";
import { z } from "zod";

import { createTrackrClient, TrackrError } from "@/lib/trackr";
import { trackrAttendancePatchPayloadSchema } from "@/lib/trackr-schema";

export const runtime = "nodejs";

const trackrAttendanceUpdateRequestSchema = z.object({
  cookie: z.string().trim().min(1, "Enter your Trackr browser cookie."),
  payload: trackrAttendancePatchPayloadSchema,
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
    const parsedRequest = trackrAttendanceUpdateRequestSchema.parse(json);
    const trackr = createTrackrClient({
      cookie: parsedRequest.cookie,
    });
    const response = await trackr.patchActivityAttendance(parsedRequest.payload);

    return noStoreJson(response ?? { ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return noStoreJson(
        {
          error: {
            code: "TRACKR_ATTENDANCE_UPDATE_REQUEST_INVALID",
            message:
              error.issues[0]?.message ??
              "Invalid Trackr attendance update request.",
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

    console.error("Unexpected /api/trackr/attendance/update error", error);

    return noStoreJson(
      {
        error: {
          code: "TRACKR_ATTENDANCE_UPDATE_UNEXPECTED",
          message: "Unexpected error while updating Trackr attendance.",
        },
      },
      500,
    );
  }
}
