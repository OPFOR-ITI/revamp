export const STATUS_VALUES = [
  "MC",
  "LD",
  "EX RMJ",
  "EX STAY IN",
  "EX CAMO",
  "EX FLEGS",
] as const;

export type Status = (typeof STATUS_VALUES)[number];

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
export const PERSONNEL_ROUTE_PATH = "/api/personnel";
export const PERSONNEL_SHEET_DEFAULT_RANGE = "Personnel!A:D";
