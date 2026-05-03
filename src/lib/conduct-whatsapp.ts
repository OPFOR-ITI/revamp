import { formatDateLabel } from "@/lib/date";

export const CONDUCT_ELIGIBLE_PLATOON_ORDER = [
  "Coy HQ",
  "Platoon 1",
  "Platoon 2",
  "Platoon 3",
  "Mobile Platoon",
] as const;

export const CONDUCT_ELIGIBLE_PLATOON_SET = new Set<string>(
  CONDUCT_ELIGIBLE_PLATOON_ORDER,
);

export const CONDUCT_WHATSAPP_LABELS: Record<
  (typeof CONDUCT_ELIGIBLE_PLATOON_ORDER)[number],
  string
> = {
  "Coy HQ": "COY HQ",
  "Platoon 1": "PL 1",
  "Platoon 2": "PL 2",
  "Platoon 3": "PL 3",
  "Mobile Platoon": "MOB",
};

export type ConductWhatsappSection = {
  platoon: (typeof CONDUCT_ELIGIBLE_PLATOON_ORDER)[number];
  label: string;
  postedStrength: number;
  participatingStrength: number;
  nonParticipatingStrength: number;
  participatingPersonnel: string[];
  nonParticipatingPersonnel: string[];
};

export type ConductWhatsappData = {
  conductName: string;
  date: string;
  sections: ConductWhatsappSection[];
};

type ConductWhatsappPerson = {
  personnelKey: string;
  rank: string;
  name: string;
  platoon: string;
};

export type ConductWhatsappNameListMode =
  | "non-participating"
  | "participating"
  | "both";

function formatTwoDigitCount(value: number) {
  return value >= 100 ? String(value) : value.toString().padStart(2, "0");
}

function comparePersonnelByName(
  left: ConductWhatsappPerson,
  right: ConductWhatsappPerson,
) {
  return left.name.localeCompare(right.name) || left.rank.localeCompare(right.rank);
}

function formatPersonnelLabel(person: ConductWhatsappPerson) {
  return `${person.rank} ${person.name}`;
}

export function isConductEligiblePlatoon(platoon: string) {
  return CONDUCT_ELIGIBLE_PLATOON_SET.has(platoon);
}

export function buildConductWhatsappData({
  conductName,
  date,
  snapshot,
  absentees,
}: {
  conductName: string;
  date: string;
  snapshot: ConductWhatsappPerson[];
  absentees: ConductWhatsappPerson[];
}): ConductWhatsappData {
  const filteredSnapshot = snapshot.filter((person) =>
    isConductEligiblePlatoon(person.platoon),
  );
  const filteredAbsentees = absentees
    .filter((person) => isConductEligiblePlatoon(person.platoon))
    .sort(comparePersonnelByName);
  const absenteeKeys = new Set(
    filteredAbsentees.map((person) => person.personnelKey),
  );

  return {
    conductName,
    date,
    sections: CONDUCT_ELIGIBLE_PLATOON_ORDER.map((platoon) => {
      const snapshotRows = filteredSnapshot
        .filter((person) => person.platoon === platoon)
        .sort(comparePersonnelByName);
      const absenteeRows = filteredAbsentees.filter((person) => person.platoon === platoon);
      const participatingRows = snapshotRows.filter(
        (person) => !absenteeKeys.has(person.personnelKey),
      );

      return {
        platoon,
        label: CONDUCT_WHATSAPP_LABELS[platoon],
        postedStrength: snapshotRows.length,
        participatingStrength: snapshotRows.length - absenteeRows.length,
        nonParticipatingStrength: absenteeRows.length,
        participatingPersonnel: participatingRows.map(formatPersonnelLabel),
        nonParticipatingPersonnel: absenteeRows.map(formatPersonnelLabel),
      };
    }),
  };
}

export function formatConductWhatsappMessage(
  data: ConductWhatsappData,
  {
    nameListMode = "non-participating",
  }: {
    nameListMode?: ConductWhatsappNameListMode;
  } = {},
) {
  const lines = [`${data.conductName} CONDUCT STATE`, `Date: ${formatDateLabel(data.date)}`];
  const includeParticipating =
    nameListMode === "participating" || nameListMode === "both";
  const includeNonParticipating =
    nameListMode === "non-participating" || nameListMode === "both";

  data.sections.forEach((section, index) => {
    lines.push("", section.label, `POSTED STRENGTH: ${formatTwoDigitCount(section.postedStrength)}`);
    lines.push(
      `PARTICIPATING STRENGTH: ${formatTwoDigitCount(section.participatingStrength)}`,
    );

    if (includeParticipating && section.participatingPersonnel.length > 0) {
      lines.push(...section.participatingPersonnel.map((name) => `> ${name}`));
    }

    lines.push(
      `NON PARTICIPATING STRENGTH: ${formatTwoDigitCount(section.nonParticipatingStrength)}`,
    );

    if (includeNonParticipating && section.nonParticipatingPersonnel.length > 0) {
      lines.push(...section.nonParticipatingPersonnel.map((name) => `> ${name}`));
    }

    if (index < data.sections.length - 1) {
      lines.push("", "—————————————");
    }
  });

  return lines.join("\n");
}
