import { PERSONNEL_SHEET_DEFAULT_RANGE } from "@/lib/constants";

const GOOGLE_SHEETS_BASE_URL = "https://sheets.googleapis.com/v4/spreadsheets";
const LEGACY_PERSONNEL_SHEET_RANGE = "Personnel!A:D";

const googleSheetsValuesResponseSchema = {
  parse(json: unknown) {
    if (
      !json ||
      typeof json !== "object" ||
      !("values" in json) ||
      !Array.isArray((json as { values?: unknown }).values)
    ) {
      throw new GoogleSheetsError(
        "GOOGLE_SHEETS_INVALID_RESPONSE",
        "Google Sheets returned an unexpected response shape.",
        502,
      );
    }

    return json as { values: string[][] };
  },
};

export class GoogleSheetsError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 502) {
    super(message);
    this.name = "GoogleSheetsError";
    this.code = code;
    this.status = status;
  }
}

function getRequiredEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;

  if (!value) {
    throw new GoogleSheetsError(
      "GOOGLE_SHEETS_ENV_MISSING",
      `Missing required server environment variable ${name}.`,
      500,
    );
  }

  return value;
}

function normalizePersonnelSheetRange(range: string) {
  const trimmedRange = range.trim();

  if (trimmedRange === LEGACY_PERSONNEL_SHEET_RANGE) {
    return PERSONNEL_SHEET_DEFAULT_RANGE;
  }

  return trimmedRange;
}

export async function fetchPersonnelSheetValues() {
  const spreadsheetId = getRequiredEnv(
    "GOOGLE_SHEETS_SPREADSHEET_ID",
    "1bu2hgyqID8XNuH7iCzR5dtb1JRzzl5KsclODcqrUogU",
  );
  const range = normalizePersonnelSheetRange(
    getRequiredEnv("GOOGLE_SHEETS_RANGE", PERSONNEL_SHEET_DEFAULT_RANGE),
  );
  const apiKey = getRequiredEnv("GOOGLE_SHEETS_API_KEY");

  const url = new URL(
    `${GOOGLE_SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(range)}`,
  );
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    let errorMessage = `Google Sheets request failed with status ${response.status}.`;

    try {
      const json = (await response.json()) as {
        error?: { message?: string };
      };

      if (json.error?.message) {
        errorMessage = json.error.message;
      }
    } catch {
      // Ignore parse errors and return the HTTP status-derived message instead.
    }

    throw new GoogleSheetsError(
      "GOOGLE_SHEETS_FETCH_FAILED",
      errorMessage,
      502,
    );
  }

  const json = googleSheetsValuesResponseSchema.parse(await response.json());

  if (!json.values.length) {
    throw new GoogleSheetsError(
      "GOOGLE_SHEETS_EMPTY_VALUES",
      "Google Sheets returned an empty values array for the Personnel range.",
      502,
    );
  }

  return json.values;
}
