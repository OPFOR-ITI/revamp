import { z } from "zod";

import {
  GOOGLE_SHEETS_ALIAS_HEADER,
  GOOGLE_SHEETS_HEADERS,
} from "@/lib/constants";

export const personnelRecordSchema = z.object({
  personnelKey: z.string(),
  rank: z.string(),
  name: z.string(),
  platoon: z.string(),
  designation: z.string(),
  alias: z.string().optional(),
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

function normalizePlatoonToken(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function resolveCanonicalPlatoon(platoon: string) {
  const normalized = normalizePlatoonToken(platoon);

  switch (normalized) {
    case "hq":
    case "coy hq":
    case "company hq":
    case "coyhq":
    case "companyhq":
      return "Coy HQ";
    case "mobile":
    case "mobile platoon":
    case "mobile pl":
    case "mobile plt":
      return "Mobile Platoon";
    case "1":
    case "platoon 1":
    case "plt 1":
    case "pl 1":
      return "Platoon 1";
    case "2":
    case "platoon 2":
    case "plt 2":
    case "pl 2":
      return "Platoon 2";
    case "3":
    case "platoon 3":
    case "plt 3":
    case "pl 3":
      return "Platoon 3";
    case "shark":
    case "shark platoon":
    case "shark pl":
    case "shark plt":
      return "Shark Platoon";
    default:
      return platoon.trim().replace(/\s+/g, " ");
  }
}

export function createPersonnelKey(
  rank: string,
  name: string,
  platoon: string,
  designation: string,
) {
  return [rank, name, resolveCanonicalPlatoon(platoon), designation]
    .map(normalizeCompositePart)
    .join("|");
}

export function formatDesignation(designation: string) {
  return designation || "-";
}

function createPersonnelLabel(record: Omit<PersonnelRecord, "label">) {
  const designation = formatDesignation(record.designation);
  return `${record.rank} ${record.name} / ${record.platoon} / ${designation}`;
}

export function getPersonnelDisplayName(person: {
  name: string;
  alias?: string;
}) {
  const alias = trimCell(person.alias);

  return alias || person.name;
}

export function normalizePersonnelRows(values: string[][]) {
  if (!values.length) {
    throw new PersonnelNormalizationError(
      "PERSONNEL_SHEET_EMPTY",
      "Google Sheets returned no rows for the Personnel range.",
    );
  }

  const actualHeaders = values[0].slice(0, 5).map(trimCell);
  const expectedHeaders = [...GOOGLE_SHEETS_HEADERS];

  const baseHeadersMatch = expectedHeaders.every(
    (header, index) => actualHeaders[index] === header,
  );
  const aliasHeader = actualHeaders[expectedHeaders.length];
  const hasAliasColumn = aliasHeader === GOOGLE_SHEETS_ALIAS_HEADER;
  const headersMatch =
    baseHeadersMatch &&
    (aliasHeader === undefined || aliasHeader === "" || hasAliasColumn);

  if (!headersMatch) {
    throw new PersonnelNormalizationError(
      "PERSONNEL_HEADERS_INVALID",
      `Expected headers ${[...expectedHeaders, GOOGLE_SHEETS_ALIAS_HEADER].join(", ")} but received ${actualHeaders.join(", ")}.`,
    );
  }

  const seenKeys = new Map<string, number>();
  const personnel: PersonnelRecord[] = [];
  let activePlatoon = "";

  values.slice(1).forEach((row, rowIndex) => {
    const rank = trimCell(row[0]);
    const name = trimCell(row[1]);
    const platoonCell = trimCell(row[2]);
    const designation = trimCell(row[3]);
    const alias = hasAliasColumn ? trimCell(row[4]) : "";
    const isBlank = !rank && !name && !platoonCell && !designation && !alias;

    if (isBlank) {
      return;
    }

    if (platoonCell) {
      activePlatoon = resolveCanonicalPlatoon(platoonCell);
    }

    if (!rank && !name && activePlatoon) {
      return;
    }

    if (!rank || !name || !activePlatoon) {
      throw new PersonnelNormalizationError(
        "PERSONNEL_ROW_INCOMPLETE",
        `Personnel row ${rowIndex + 2} is incomplete. Rank, Name, and Platoon are required.`,
      );
    }

    const platoon = activePlatoon;

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
      alias: alias || undefined,
    };

    personnel.push({
      ...recordWithoutLabel,
      label: createPersonnelLabel(recordWithoutLabel),
    });
  });

  return personnel;
}
