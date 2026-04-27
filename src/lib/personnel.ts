import { z } from "zod";

import { GOOGLE_SHEETS_HEADERS } from "@/lib/constants";

export const personnelRecordSchema = z.object({
  personnelKey: z.string(),
  rank: z.string(),
  name: z.string(),
  platoon: z.string(),
  designation: z.string(),
  label: z.string(),
});

export type PersonnelRecord = z.infer<typeof personnelRecordSchema>;

export class PersonnelNormalizationError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 500) {
    super(message);
    this.name = "PersonnelNormalizationError";
    this.code = code;
    this.status = status;
  }
}

function trimCell(value: string | undefined) {
  return (value ?? "").trim();
}

function normalizeCompositePart(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function createPersonnelKey(
  rank: string,
  name: string,
  platoon: string,
  designation: string,
) {
  return [rank, name, platoon, designation]
    .map(normalizeCompositePart)
    .join("|");
}

export function formatDesignation(designation: string) {
  return designation || "No designation";
}

function createPersonnelLabel(record: Omit<PersonnelRecord, "label">) {
  const designation = formatDesignation(record.designation);
  return `${record.rank} ${record.name} / ${record.platoon} / ${designation}`;
}

export function normalizePersonnelRows(values: string[][]) {
  if (!values.length) {
    throw new PersonnelNormalizationError(
      "PERSONNEL_SHEET_EMPTY",
      "Google Sheets returned no rows for the Personnel range.",
    );
  }

  const actualHeaders = values[0].slice(0, 4).map(trimCell);
  const expectedHeaders = [...GOOGLE_SHEETS_HEADERS];

  const headersMatch =
    actualHeaders.length === expectedHeaders.length &&
    actualHeaders.every((header, index) => header === expectedHeaders[index]);

  if (!headersMatch) {
    throw new PersonnelNormalizationError(
      "PERSONNEL_HEADERS_INVALID",
      `Expected headers ${expectedHeaders.join(", ")} but received ${actualHeaders.join(", ")}.`,
    );
  }

  const seenKeys = new Map<string, number>();
  const personnel: PersonnelRecord[] = [];

  values.slice(1).forEach((row, rowIndex) => {
    const rank = trimCell(row[0]);
    const name = trimCell(row[1]);
    const platoon = trimCell(row[2]);
    const designation = trimCell(row[3]);
    const isBlank = !rank && !name && !platoon && !designation;

    if (isBlank) {
      return;
    }

    if (!rank || !name || !platoon) {
      throw new PersonnelNormalizationError(
        "PERSONNEL_ROW_INCOMPLETE",
        `Personnel row ${rowIndex + 2} is incomplete. Rank, Name, and Platoon are required.`,
      );
    }

    const personnelKey = createPersonnelKey(rank, name, platoon, designation);
    const previousRow = seenKeys.get(personnelKey);

    if (previousRow) {
      const designationLabel = formatDesignation(designation);
      throw new PersonnelNormalizationError(
        "PERSONNEL_DUPLICATE_UNSUPPORTED",
        `Duplicate personnel rows detected for ${rank} ${name} (${platoon}, ${designationLabel}) at rows ${previousRow} and ${rowIndex + 2}.`,
      );
    }

    seenKeys.set(personnelKey, rowIndex + 2);

    const recordWithoutLabel = {
      personnelKey,
      rank,
      name,
      platoon,
      designation,
    };

    personnel.push({
      ...recordWithoutLabel,
      label: createPersonnelLabel(recordWithoutLabel),
    });
  });

  return personnel;
}
