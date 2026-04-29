export const STATUS_DEFINITIONS = [
  { value: "MC", affectsParadeState: true },
  { value: "RIB", affectsParadeState: true },
  { value: "LD", affectsParadeState: false },
  { value: "EX RMJ", affectsParadeState: false },
  { value: "OFF", affectsParadeState: true },
  { value: "LEAVE", affectsParadeState: true },
  { value: "RSO", affectsParadeState: true },
  { value: "MA", affectsParadeState: true },
  { value: "SEND OUT", affectsParadeState: true },
  { value: "BOOKED OUT", affectsParadeState: true },
  { value: "HOSPITALISED", affectsParadeState: true },
  { value: "EX STAY IN", affectsParadeState: true },
  { value: "AWOL", affectsParadeState: true },
  { value: "DB", affectsParadeState: true },
  { value: "EX CAMO", affectsParadeState: false },
  { value: "EX FLEGS", affectsParadeState: false },
  { value: "EX HEAVY LOAD", affectsParadeState: false },
  { value: "EX SQUATTING", affectsParadeState: false },
  { value: "EX EXPLOSIVES & PYROTECHNICS", affectsParadeState: false },
  { value: "EX DUST", affectsParadeState: false },
  { value: "EX DRIVING", affectsParadeState: false },
  { value: "EX PUSHUPS", affectsParadeState: false },
  { value: "EX UPPER LIMB", affectsParadeState: false },
  { value: "EX PULL UP", affectsParadeState: false },
  { value: "EX CHIN UP", affectsParadeState: false },
  { value: "EX HELMET", affectsParadeState: false },
  { value: "EX LOUD NOISE ENVIRONMENT", affectsParadeState: false },
  { value: "EX LOUD NOISE VOCATION", affectsParadeState: false },
  { value: "EX OVERSEAS DEPLOYEMENT", affectsParadeState: false },
  { value: "Others", affectsParadeState: false },
] as const;

export type Status = (typeof STATUS_DEFINITIONS)[number]["value"];
export const OTHER_STATUS_VALUE = "Others" as const;

function mapStatusValues<const T extends readonly { value: string }[]>(definitions: T) {
  return definitions.map((definition) => definition.value) as [
    T[number]["value"],
    ...T[number]["value"][],
  ];
}

export const STATUS_VALUES = mapStatusValues(STATUS_DEFINITIONS);

export const HIDE_RECORD_PERIOD_METADATA_STATUSES: readonly Status[] = [
  "AWOL",
  "DB",
  "SEND OUT",
];

export const STATUS_AFFECTS_PARADE_STATE = Object.fromEntries(
  STATUS_DEFINITIONS.map((definition) => [
    definition.value,
    definition.affectsParadeState,
  ]),
) as Record<Status, boolean>;

export function doesStatusAffectParadeState(status: Status) {
  return STATUS_AFFECTS_PARADE_STATE[status];
}

export function isOtherStatus(status: Status) {
  return status === OTHER_STATUS_VALUE;
}

export function formatStatusLabel(status: Status, customStatus?: string) {
  if (!isOtherStatus(status)) {
    return status;
  }

  const normalizedCustomStatus = customStatus?.trim();

  return normalizedCustomStatus || OTHER_STATUS_VALUE;

  // return normalizedCustomStatus
  //   ? `${OTHER_STATUS_VALUE}(${normalizedCustomStatus})`
  //   : OTHER_STATUS_VALUE;
}

export function shouldHideRecordPeriodMetadata(status: Status) {
  return HIDE_RECORD_PERIOD_METADATA_STATUSES.includes(status);
}

export function isPermanentRecord(record: {
  isPermanent?: boolean;
  endDate?: string;
}) {
  return record.isPermanent ?? !record.endDate;
}

export const USER_ROLE_VALUES = ["admin", "operator"] as const;
export type UserRole = (typeof USER_ROLE_VALUES)[number];

export const APPROVAL_STATUS_VALUES = [
  "pending",
  "approved",
  "rejected",
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUS_VALUES)[number];

export const GOOGLE_SHEETS_HEADERS = [
  "Rank",
  "Name",
  "Platoon",
  "Designation",
] as const;

export const SINGAPORE_TIME_ZONE = "Asia/Singapore";
export const MAX_REMARKS_LENGTH = 500;
export const MAX_CUSTOM_STATUS_LENGTH = 100;
export const PERSONNEL_ROUTE_PATH = "/api/personnel";
export const PERSONNEL_SHEET_DEFAULT_RANGE = "Personnel!A:D";
