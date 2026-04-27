import { NextResponse } from "next/server";

import {
  fetchPersonnelSheetValues,
  GoogleSheetsError,
} from "@/lib/google-sheets";
import {
  normalizePersonnelRows,
  PersonnelNormalizationError,
} from "@/lib/personnel";

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET() {
  try {
    const values = await fetchPersonnelSheetValues();
    const personnel = normalizePersonnelRows(values);

    return noStoreJson(personnel);
  } catch (error) {
    if (
      error instanceof GoogleSheetsError ||
      error instanceof PersonnelNormalizationError
    ) {
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

    console.error("Unexpected /api/personnel error", error);

    return noStoreJson(
      {
        error: {
          code: "PERSONNEL_ROUTE_UNEXPECTED",
          message: "Unexpected error while loading personnel.",
        },
      },
      500,
    );
  }
}
