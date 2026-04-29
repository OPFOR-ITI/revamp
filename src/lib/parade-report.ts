import type { DutyAssignmentDoc } from "@/components/duties/types";
import type { ParadeStateRecordDoc } from "@/components/parade-state/types";
import {
  dateStringToDayIndex,
  formatCompactDateLabel,
  isValidTimeHHmm,
} from "@/lib/date";
import { shouldHideRecordPeriodMetadata } from "@/lib/constants";
import {
  createPersonnelKey,
  type PersonnelRecord,
} from "@/lib/personnel";

export const PARADE_REPORT_PLATOON_ORDER = [
  "Coy HQ",
  "Mobile Platoon",
  "Platoon 1",
  "Platoon 2",
  "Platoon 3",
  "Shark Platoon",
] as const;

export const PARADE_REPORT_COMMANDER_RANKS = new Set([
  "3SG",
  "2SG",
  "1SG",
  "SSG",
  "MSG",
  "3WO",
  "2WO",
  "1WO",
  "MWO",
  "SWO",
  "CWO",
  "2LT",
  "LTA",
  "CPT",
  "MAJ",
  "LTC",
  "SLTC",
  "COL",
  "BG",
  "MG",
  "LG",
]);

export const PARADE_REPORT_TROOPER_RANKS = new Set([
  "REC",
  "PTE",
  "LCP",
  "CPL",
  "CFC",
]);

type CompanyOutBucket =
  | "MC"
  | "EX_STAY_IN"
  | "HOSPITALISED"
  | "RSO"
  | "OFF"
  | "LEAVE"
  | "DB"
  | "BOOKED_OUT"
  | "OTHERS";

type StatusLikeRecord = Pick<
  ParadeStateRecordDoc,
  | "rank"
  | "name"
  | "platoon"
  | "status"
  | "customStatus"
  | "startDate"
  | "endDate"
  | "isPermanent"
  | "remarks"
  | "createdAt"
  | "updatedAt"
>;

type PersonnelAbsence = {
  personnel: PersonnelRecord;
  primaryRecord: ParadeStateRecordDoc;
  secondaryRecords: ParadeStateRecordDoc[];
  companyBucket: CompanyOutBucket;
};

export type ParadeDutyPersonnel = {
  cdo: string;
  cds: string;
  cos: string;
  pdsHq: string;
  pds1: string;
  pds2: string;
  pds3: string;
  pdsMobile: string;
};

export type ParadeCategoryCount = {
  inCamp: number;
  total: number;
};

export type ParadeSummary = {
  overallCoyStrength: number;
  platoonStrengths: Record<(typeof PARADE_REPORT_PLATOON_ORDER)[number], number>;
  strengthInCamp: number;
  strengthOutOfCamp: number;
  commanders: ParadeCategoryCount;
  troopers: ParadeCategoryCount;
  supportStaff: ParadeCategoryCount;
  confined: number;
  sol: number;
  stayIn: number;
  companyOutBreakdown: {
    mc: number;
    exStayIn: number;
    hospitalised: number;
    rso: number;
    off: number;
    leave: number;
    db: number;
    bookedOut: number;
    others: number;
    othersBreakdown: Array<{ label: string; count: number }>;
  };
};

export type ParadePlatoonSection = {
  platoon: (typeof PARADE_REPORT_PLATOON_ORDER)[number];
  totalStrength: number;
  inCamp: number;
  outOfCamp: number;
  commanderCount: ParadeCategoryCount;
  enlistedLabel: "Troopers" | "Support Staff";
  enlistedCount: ParadeCategoryCount;
  mcEntries: string[];
  otherEntries: string[];
  statusEntries: string[];
};

export type ParadeReportData = {
  paradeDate: string;
  asAtTime: string;
  duties: ParadeDutyPersonnel;
  summary: ParadeSummary;
  platoons: ParadePlatoonSection[];
  warnings: string[];
};

const PLATOON_SECTION_LABELS = {
  "Coy HQ": "A. Coy HQ",
  "Mobile Platoon": "B. Mobile Platoon",
  "Platoon 1": "C. Platoon 1",
  "Platoon 2": "D. Platoon 2",
  "Platoon 3": "E. Platoon 3",
  "Shark Platoon": "F. Shark Platoon",
} as const;

const PRIMARY_BUCKET_PRECEDENCE: Record<CompanyOutBucket, number> = {
  HOSPITALISED: 0,
  MC: 1,
  RSO: 2,
  EX_STAY_IN: 3,
  LEAVE: 4,
  OFF: 5,
  DB: 6,
  BOOKED_OUT: 7,
  OTHERS: 8,
};

function normalizeComparableText(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function formatTwoDigitCount(value: number) {
  return value >= 100 ? String(value) : value.toString().padStart(2, "0");
}

function compareByName(
  left: { rank: string; name: string },
  right: { rank: string; name: string },
) {
  return (
    left.rank.localeCompare(right.rank) ||
    left.name.localeCompare(right.name)
  );
}

function isCommanderRank(rank: string) {
  return PARADE_REPORT_COMMANDER_RANKS.has(normalizeComparableText(rank));
}

function isTrooperRank(rank: string) {
  return PARADE_REPORT_TROOPER_RANKS.has(normalizeComparableText(rank));
}

function getCompanyBucketForStatus(record: ParadeStateRecordDoc): CompanyOutBucket {
  switch (normalizeComparableText(record.status)) {
    case "HOSPITALISED":
      return "HOSPITALISED";
    case "MC":
      return "MC";
    case "RSO":
      return "RSO";
    case "EX STAY IN":
      return "EX_STAY_IN";
    case "LEAVE":
      return "LEAVE";
    case "OFF":
      return "OFF";
    case "DB":
      return "DB";
    case "BOOKED OUT":
    default:
      return "OTHERS";
  }
}

function comparePrimaryRecords(left: ParadeStateRecordDoc, right: ParadeStateRecordDoc) {
  const bucketDelta =
    PRIMARY_BUCKET_PRECEDENCE[getCompanyBucketForStatus(left)] -
    PRIMARY_BUCKET_PRECEDENCE[getCompanyBucketForStatus(right)];

  if (bucketDelta !== 0) {
    return bucketDelta;
  }

  if (right.createdAt !== left.createdAt) {
    return right.createdAt - left.createdAt;
  }

  if (right.updatedAt !== left.updatedAt) {
    return right.updatedAt - left.updatedAt;
  }

  return 0;
}

function formatCompactDateRange(record: Pick<ParadeStateRecordDoc, "startDate" | "endDate" | "isPermanent">) {
  const start = formatCompactDateLabel(record.startDate);

  if (record.isPermanent || !record.endDate) {
    return start;
  }

  const end = formatCompactDateLabel(record.endDate);

  return start === end ? start : `${start}-${end}`;
}

function getInclusiveDurationDays(record: Pick<ParadeStateRecordDoc, "startDate" | "endDate" | "isPermanent">) {
  if (record.isPermanent || !record.endDate) {
    return null;
  }

  return dateStringToDayIndex(record.endDate) - dateStringToDayIndex(record.startDate) + 1;
}

function formatStatusLabel(record: Pick<ParadeStateRecordDoc, "status" | "customStatus">) {
  if (record.status === "Others") {
    return record.customStatus?.trim() || "Others";
  }

  return record.status;
}

function formatStatusSummary(record: StatusLikeRecord) {
  const label = formatStatusLabel(record);
  const remarkPart = record.remarks?.trim() ? `; ${record.remarks.trim()}` : "";

  if (shouldHideRecordPeriodMetadata(record.status)) {
    return `${label}${remarkPart}`.trim();
  }

  if (record.isPermanent || !record.endDate) {
    return `PERM ${label}${remarkPart}`.trim();
  }

  const durationDays = getInclusiveDurationDays(record);
  const datePart = formatCompactDateRange(record);
  const durationPart = durationDays ? `${durationDays}D ` : "";

  return `${label} ${durationPart}${datePart}${remarkPart}`.trim();
}

function formatPersonLine(personnel: PersonnelRecord, details: string) {
  return `${personnel.rank} ${personnel.name} (${details})`;
}

function formatAbsenceLine(absence: PersonnelAbsence) {
  const primary = formatStatusSummary(absence.primaryRecord);
  const secondary = absence.secondaryRecords.map((record) => formatStatusSummary(record));
  const suffix =
    secondary.length > 0 ? `, ${secondary.join(", ")}` : "";

  return formatPersonLine(absence.personnel, `${primary}${suffix}`);
}

function formatStatusEntry(
  personnel: PersonnelRecord,
  records: ParadeStateRecordDoc[],
) {
  return formatPersonLine(
    personnel,
    records.map((record) => formatStatusSummary(record)).join(", "),
  );
}

function normalizeOthersBreakdownLabel(record: ParadeStateRecordDoc) {
  if (record.status === "Others") {
    return record.customStatus?.trim() || "Others";
  }

  return record.status;
}

function groupPersonnelByKey(personnel: PersonnelRecord[]) {
  return new Map(personnel.map((record) => [record.personnelKey, record]));
}

function groupPersonnelByCanonicalIdentity(personnel: PersonnelRecord[]) {
  return new Map(
    personnel.map((record) => [
      createPersonnelKey(
        record.rank,
        record.name,
        record.platoon,
        record.designation,
      ),
      record,
    ]),
  );
}

function chooseDutyAssignment(
  assignments: DutyAssignmentDoc[],
  matcher: (assignment: DutyAssignmentDoc) => boolean,
) {
  return assignments
    .filter(matcher)
    .sort((left, right) => {
      if (right.createdAt !== left.createdAt) {
        return right.createdAt - left.createdAt;
      }

      return right.updatedAt - left.updatedAt;
    })[0];
}

function formatDutyAssignee(assignment?: DutyAssignmentDoc) {
  return assignment ? `${assignment.rank} ${assignment.name}` : "[UNASSIGNED]";
}

function resolveDutyPersonnel(dutyAssignments: DutyAssignmentDoc[]): ParadeDutyPersonnel {
  const cdoAssignment =
    chooseDutyAssignment(
      dutyAssignments,
      (assignment) =>
        assignment.dutyPreset === "CDO" ||
        normalizeComparableText(assignment.dutyType) === "CDO",
    ) ??
    chooseDutyAssignment(
      dutyAssignments,
      (assignment) =>
        assignment.dutyPreset === "DOO" ||
        normalizeComparableText(assignment.dutyType) === "DOO",
    );

  const cdsAssignment = chooseDutyAssignment(
    dutyAssignments,
    (assignment) =>
      assignment.dutyPreset === "CDS" ||
      normalizeComparableText(assignment.dutyType) === "CDS",
  );
  const cosAssignment = chooseDutyAssignment(
    dutyAssignments,
    (assignment) =>
      assignment.dutyPreset === "COS" ||
      normalizeComparableText(assignment.dutyType) === "COS",
  );

  return {
    cdo: formatDutyAssignee(cdoAssignment),
    cds: formatDutyAssignee(cdsAssignment),
    cos: formatDutyAssignee(cosAssignment),
    pdsHq: "All Seccoms",
    pds1: "All Seccoms",
    pds2: "All Seccoms",
    pds3: "All Seccoms",
    pdsMobile: "All Seccoms",
  };
}

export function buildParadeReportData({
  personnel,
  activeRecords,
  dutyAssignments,
  paradeDate,
  asAtTime,
}: {
  personnel: PersonnelRecord[];
  activeRecords: ParadeStateRecordDoc[];
  dutyAssignments: DutyAssignmentDoc[];
  paradeDate: string;
  asAtTime: string;
}): ParadeReportData {
  if (!isValidTimeHHmm(asAtTime)) {
    throw new Error('As-at time must use the "HHmm" format.');
  }

  const warnings: string[] = [];
  const personnelByKey = groupPersonnelByKey(personnel);
  const personnelByCanonicalIdentity = groupPersonnelByCanonicalIdentity(personnel);
  const knownPlatoons = new Set(PARADE_REPORT_PLATOON_ORDER);
  const activePersonnelRecords = new Map<string, ParadeStateRecordDoc[]>();
  const activeStatusRecords = new Map<string, ParadeStateRecordDoc[]>();

  for (const person of personnel) {
    if (!knownPlatoons.has(person.platoon as (typeof PARADE_REPORT_PLATOON_ORDER)[number])) {
      warnings.push(
        `Nominal roll entry ${person.rank} ${person.name} uses an unexpected platoon label "${person.platoon}".`,
      );
    }
  }

  for (const record of activeRecords) {
    const person =
      personnelByKey.get(record.personnelKey) ??
      personnelByCanonicalIdentity.get(
        createPersonnelKey(
          record.rank,
          record.name,
          record.platoon,
          record.designation,
        ),
      );

    if (!person) {
      warnings.push(
        `Ignored active record for ${record.rank} ${record.name} because the serviceman is no longer in the current nominal roll.`,
      );
      continue;
    }

    const targetMap = record.affectParadeState
      ? activePersonnelRecords
      : activeStatusRecords;
    const existing = targetMap.get(person.personnelKey) ?? [];
    existing.push(record);
    targetMap.set(person.personnelKey, existing);
  }

  const absences = new Map<string, PersonnelAbsence>();

  for (const [personnelKey, records] of activePersonnelRecords) {
    const person = personnelByKey.get(personnelKey);

    if (!person || records.length === 0) {
      continue;
    }

    const sortedRecords = [...records].sort(comparePrimaryRecords);
    const [primaryRecord, ...secondaryRecords] = sortedRecords;

    absences.set(personnelKey, {
      personnel: person,
      primaryRecord,
      secondaryRecords,
      companyBucket: getCompanyBucketForStatus(primaryRecord),
    });
  }

  const platoonStrengths = Object.fromEntries(
    PARADE_REPORT_PLATOON_ORDER.map((platoon) => [
      platoon,
      personnel.filter((person) => person.platoon === platoon).length,
    ]),
  ) as Record<(typeof PARADE_REPORT_PLATOON_ORDER)[number], number>;

  const allAbsences = Array.from(absences.values());
  const totalCommanders = personnel.filter((person) => isCommanderRank(person.rank)).length;
  const totalSupportStaff = personnel.filter(
    (person) => person.platoon === "Coy HQ" && isTrooperRank(person.rank),
  ).length;
  const totalTroopers = personnel.filter(
    (person) => person.platoon !== "Coy HQ" && isTrooperRank(person.rank),
  ).length;

  const commandersOut = allAbsences.filter((absence) =>
    isCommanderRank(absence.personnel.rank),
  ).length;
  const supportStaffOut = allAbsences.filter(
    (absence) =>
      absence.personnel.platoon === "Coy HQ" &&
      isTrooperRank(absence.personnel.rank),
  ).length;
  const troopersOut = allAbsences.filter(
    (absence) =>
      absence.personnel.platoon !== "Coy HQ" &&
      isTrooperRank(absence.personnel.rank),
  ).length;

  const othersBreakdownMap = new Map<string, number>();
  const companyOutCounts: Record<CompanyOutBucket, number> = {
    MC: 0,
    EX_STAY_IN: 0,
    HOSPITALISED: 0,
    RSO: 0,
    OFF: 0,
    LEAVE: 0,
    DB: 0,
    BOOKED_OUT: 0,
    OTHERS: 0,
  };

  for (const absence of allAbsences) {
    companyOutCounts[absence.companyBucket] += 1;

    if (absence.companyBucket === "OTHERS") {
      const label = normalizeOthersBreakdownLabel(absence.primaryRecord);
      othersBreakdownMap.set(label, (othersBreakdownMap.get(label) ?? 0) + 1);
    }
  }

  const platoons = PARADE_REPORT_PLATOON_ORDER.map((platoon) => {
    const platoonPersonnel = personnel
      .filter((person) => person.platoon === platoon)
      .sort(compareByName);
    const platoonAbsences = allAbsences
      .filter((absence) => absence.personnel.platoon === platoon)
      .sort((left, right) => compareByName(left.personnel, right.personnel));
    const platoonStatuses = platoonPersonnel.flatMap((person) => {
      const personStatuses = (activeStatusRecords.get(person.personnelKey) ?? [])
        .slice()
        .sort((left, right) => comparePrimaryRecords(left, right));

      return personStatuses.length > 0
        ? [formatStatusEntry(person, personStatuses)]
        : [];
    });
    const mcEntries = platoonAbsences
      .filter((absence) => absence.companyBucket === "MC")
      .map(formatAbsenceLine);
    const otherEntries = platoonAbsences
      .filter((absence) => absence.companyBucket !== "MC")
      .map(formatAbsenceLine);

    const commanderTotal = platoonPersonnel.filter((person) =>
      isCommanderRank(person.rank),
    ).length;
    const commanderOut = platoonAbsences.filter((absence) =>
      isCommanderRank(absence.personnel.rank),
    ).length;
    const enlistedLabel = platoon === "Coy HQ" ? "Support Staff" : "Troopers";
    const enlistedTotal = platoonPersonnel.filter((person) =>
      isTrooperRank(person.rank),
    ).length;
    const enlistedOut = platoonAbsences.filter((absence) =>
      isTrooperRank(absence.personnel.rank),
    ).length;

    return {
      platoon,
      totalStrength: platoonPersonnel.length,
      inCamp: platoonPersonnel.length - platoonAbsences.length,
      outOfCamp: platoonAbsences.length,
      commanderCount: {
        inCamp: commanderTotal - commanderOut,
        total: commanderTotal,
      },
      enlistedLabel,
      enlistedCount: {
        inCamp: enlistedTotal - enlistedOut,
        total: enlistedTotal,
      },
      mcEntries,
      otherEntries,
      statusEntries: platoonStatuses,
    } satisfies ParadePlatoonSection;
  });

  const duties = resolveDutyPersonnel(dutyAssignments);

  if (duties.cdo === "[UNASSIGNED]") {
    warnings.push("No CDO or DOO assignment exists for the selected date.");
  }

  if (duties.cds === "[UNASSIGNED]") {
    warnings.push("No CDS assignment exists for the selected date.");
  }

  if (duties.cos === "[UNASSIGNED]") {
    warnings.push("No COS assignment exists for the selected date.");
  }

  return {
    paradeDate,
    asAtTime,
    duties,
    summary: {
      overallCoyStrength: personnel.length,
      platoonStrengths,
      strengthInCamp: personnel.length - allAbsences.length,
      strengthOutOfCamp: allAbsences.length,
      commanders: {
        inCamp: totalCommanders - commandersOut,
        total: totalCommanders,
      },
      troopers: {
        inCamp: totalTroopers - troopersOut,
        total: totalTroopers,
      },
      supportStaff: {
        inCamp: totalSupportStaff - supportStaffOut,
        total: totalSupportStaff,
      },
      confined: 0,
      sol: 0,
      stayIn: 0,
      companyOutBreakdown: {
        mc: companyOutCounts.MC,
        exStayIn: companyOutCounts.EX_STAY_IN,
        hospitalised: companyOutCounts.HOSPITALISED,
        rso: companyOutCounts.RSO,
        off: companyOutCounts.OFF,
        leave: companyOutCounts.LEAVE,
        db: companyOutCounts.DB,
        bookedOut: companyOutCounts.BOOKED_OUT,
        others: companyOutCounts.OTHERS,
        othersBreakdown: Array.from(othersBreakdownMap.entries())
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([label, count]) => ({ label, count })),
      },
    },
    platoons,
    warnings: Array.from(new Set(warnings)),
  };
}

export function formatParadeReportText(data: ParadeReportData) {
  const lines = [
    `*OPFOR Coy Parade State for ${formatCompactDateLabel(data.paradeDate)} as at ${data.asAtTime}hrs*`,
    "==========",
    "*1. Duty Personnel*",
    `• CDO - ${data.duties.cdo}`,
    `• CDS - ${data.duties.cds}`,
    `• COS - ${data.duties.cos}`,
    "",
    `• PDS HQ - ${data.duties.pdsHq}`,
    `• PDS 1 - ${data.duties.pds1}`,
    `• PDS 2 - ${data.duties.pds2}`,
    `• PDS 3 - ${data.duties.pds3}`,
    `• PDS MOBILE - ${data.duties.pdsMobile}`,
    "",
    "➖➖➖➖➖➖➖➖➖➖",
    "",
    "*2. Summary of Strengths*",
    "",
    `*a. Overall Coy Strength = ${formatTwoDigitCount(data.summary.overallCoyStrength)}*`,
    `• Coy HQ - ${formatTwoDigitCount(data.summary.platoonStrengths["Coy HQ"])}`,
    `• Mobile Platoon - ${formatTwoDigitCount(data.summary.platoonStrengths["Mobile Platoon"])}`,
    `• Platoon 1 - ${formatTwoDigitCount(data.summary.platoonStrengths["Platoon 1"])}`,
    `• Platoon 2 - ${formatTwoDigitCount(data.summary.platoonStrengths["Platoon 2"])}`,
    `• Platoon 3 - ${formatTwoDigitCount(data.summary.platoonStrengths["Platoon 3"])}`,
    `• Shark Platoon - ${formatTwoDigitCount(data.summary.platoonStrengths["Shark Platoon"])}`,
    "",
    `*b. Strength in Camp = ${formatTwoDigitCount(data.summary.strengthInCamp)}/${formatTwoDigitCount(data.summary.overallCoyStrength)}*`,
    `• Commanders: ${formatTwoDigitCount(data.summary.commanders.inCamp)}/${formatTwoDigitCount(data.summary.commanders.total)}`,
    `• Troopers: ${formatTwoDigitCount(data.summary.troopers.inCamp)}/${formatTwoDigitCount(data.summary.troopers.total)}`,
    `• Support Staff: ${formatTwoDigitCount(data.summary.supportStaff.inCamp)}/${formatTwoDigitCount(data.summary.supportStaff.total)}`,
    "",
    `> Confined: ${formatTwoDigitCount(data.summary.confined)}`,
    `> SOL: ${formatTwoDigitCount(data.summary.sol)}`,
    `> Stay In: ${formatTwoDigitCount(data.summary.stayIn)}`,
    "",
    `*c. Strength out of Camp = ${formatTwoDigitCount(data.summary.strengthOutOfCamp)}/${formatTwoDigitCount(data.summary.overallCoyStrength)}*`,
    `• MC - ${formatTwoDigitCount(data.summary.companyOutBreakdown.mc)}`,
    `• Ex Stay-In - ${formatTwoDigitCount(data.summary.companyOutBreakdown.exStayIn)}`,
    `• Hospitalised - ${formatTwoDigitCount(data.summary.companyOutBreakdown.hospitalised)}`,
    `• RSO - ${formatTwoDigitCount(data.summary.companyOutBreakdown.rso)}`,
    `• Off - ${formatTwoDigitCount(data.summary.companyOutBreakdown.off)}`,
    `• Leave - ${formatTwoDigitCount(data.summary.companyOutBreakdown.leave)}`,
    `• DB - ${formatTwoDigitCount(data.summary.companyOutBreakdown.db)}`,
    `• Booked Out - ${formatTwoDigitCount(data.summary.companyOutBreakdown.bookedOut)}`,
    `• Others - ${formatTwoDigitCount(data.summary.companyOutBreakdown.others)}`,
  ];

  if (data.summary.companyOutBreakdown.othersBreakdown.length > 0) {
    const breakdown = data.summary.companyOutBreakdown.othersBreakdown
      .map(({ label, count }) => `${formatTwoDigitCount(count)} ${label}`)
      .join(", ");
    lines.push(`  (${breakdown})`);
  }

  for (const platoon of data.platoons) {
    lines.push(
      "",
      "➖➖➖➖➖➖➖➖➖➖",
      "",
      `*${PLATOON_SECTION_LABELS[platoon.platoon]}*`,
      "",
      `*i. Strength in Camp = ${formatTwoDigitCount(platoon.inCamp)}/${formatTwoDigitCount(platoon.totalStrength)}*`,
      `• Commanders - ${formatTwoDigitCount(platoon.commanderCount.inCamp)}/${formatTwoDigitCount(platoon.commanderCount.total)}`,
      `• ${platoon.enlistedLabel} - ${formatTwoDigitCount(platoon.enlistedCount.inCamp)}/${formatTwoDigitCount(platoon.enlistedCount.total)}`,
      "",
      `*ii. Strength out of Camp = ${formatTwoDigitCount(platoon.outOfCamp)}/${formatTwoDigitCount(platoon.totalStrength)}*`,
      "",
      `• MC - ${formatTwoDigitCount(platoon.mcEntries.length)}`,
    );

    platoon.mcEntries.forEach((entry, index) => {
      lines.push(`${index + 1}. ${entry}`);
    });

    lines.push("", `• Others - ${formatTwoDigitCount(platoon.otherEntries.length)}`);

    platoon.otherEntries.forEach((entry, index) => {
      lines.push(`${index + 1}. ${entry}`);
    });

    lines.push("", `*iii. Statuses = ${formatTwoDigitCount(platoon.statusEntries.length)}*`);

    platoon.statusEntries.forEach((entry, index) => {
      lines.push(`${index + 1}. ${entry}`);
    });
  }

  return lines.join("\n");
}
