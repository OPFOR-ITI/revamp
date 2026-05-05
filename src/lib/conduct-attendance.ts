export const CONDUCT_ATTENDANCE_REASON_VALUES = [
  "Present",
  "MC",
  "Leave",
  "Off",
  "Fall Out",
  "Other",
] as const;

export const CONDUCT_NON_PRESENT_REASON_VALUES = [
  "MC",
  "Leave",
  "Off",
  "Fall Out",
  "Other",
] as const;

export type ConductAttendanceReason =
  (typeof CONDUCT_ATTENDANCE_REASON_VALUES)[number];
export type ConductNonPresentReason =
  (typeof CONDUCT_NON_PRESENT_REASON_VALUES)[number];

export const TRACKR_REQUIRED_ATTENDANCE_STATUS_NAMES =
  CONDUCT_ATTENDANCE_REASON_VALUES;

export function normalizeAttendanceComparableText(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export function normalizeAttendanceName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function tokenizeAttendanceComparableName(value: string) {
  const tokens = normalizeAttendanceName(value).split(" ").filter(Boolean);

  while (tokens.length > 1 && /\d/.test(tokens[0] ?? "")) {
    tokens.shift();
  }

  return tokens.map((token) => token.toUpperCase());
}

export function normalizeAttendanceComparableName(value: string) {
  return tokenizeAttendanceComparableName(value).join(" ").trim();
}

function levenshteinDistance(left: string, right: string) {
  if (left === right) {
    return 0;
  }

  if (left.length === 0) {
    return right.length;
  }

  if (right.length === 0) {
    return left.length;
  }

  const previousRow = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    let previousDiagonal = previousRow[0] ?? 0;
    previousRow[0] = leftIndex + 1;

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const currentValue = previousRow[rightIndex + 1] ?? 0;
      const substitutionCost = left[leftIndex] === right[rightIndex] ? 0 : 1;

      previousRow[rightIndex + 1] = Math.min(
        (previousRow[rightIndex] ?? 0) + 1,
        currentValue + 1,
        previousDiagonal + substitutionCost,
      );
      previousDiagonal = currentValue;
    }
  }

  return previousRow[right.length] ?? 0;
}

function areComparableNameTokensEquivalent(left: string, right: string) {
  if (left === right) {
    return true;
  }

  return levenshteinDistance(left, right) <= 1;
}

export function areAttendanceComparableNamesMatching(
  leftName: string,
  rightName: string,
) {
  const leftTokens = tokenizeAttendanceComparableName(leftName).sort();
  const rightTokens = tokenizeAttendanceComparableName(rightName).sort();

  if (leftTokens.length !== rightTokens.length) {
    return false;
  }

  return leftTokens.every((leftToken, index) =>
    areComparableNameTokensEquivalent(leftToken, rightTokens[index] ?? ""),
  );
}

export function isConductNonPresentReason(
  value: string,
): value is ConductNonPresentReason {
  return (CONDUCT_NON_PRESENT_REASON_VALUES as readonly string[]).includes(value);
}

export function mapConductAttendanceReasonToTrackrStatus(
  reason: ConductAttendanceReason,
) {
  return reason;
}
