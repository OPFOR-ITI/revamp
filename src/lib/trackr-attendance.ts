import {
  normalizeAttendanceComparableText,
  normalizeAttendanceName,
} from "@/lib/conduct-attendance";
import type {
  TrackrActivityAttendanceRow,
  TrackrMixedId,
  TrackrStatus,
} from "@/lib/trackr-schema";

export type NormalizedTrackrAttendanceRow = {
  attendanceId: TrackrMixedId;
  userId?: string;
  name: string;
  currentStatusId?: TrackrMixedId;
  currentStatusName?: string;
  currentRemarks?: string;
};

function getTrackrRowStatusName(row: TrackrActivityAttendanceRow) {
  if (typeof row.status === "string") {
    return normalizeAttendanceName(row.status);
  }

  if (row.status?.name) {
    return normalizeAttendanceName(row.status.name);
  }

  return undefined;
}

export function normalizeTrackrStatusName(value: string) {
  return normalizeAttendanceComparableText(value);
}

export function buildTrackrStatusIdByName(statuses: TrackrStatus[]) {
  return new Map(
    statuses.map((status) => [
      normalizeTrackrStatusName(status.name),
      status.id,
    ] as const),
  );
}

export function normalizeTrackrAttendanceRows(
  rows: TrackrActivityAttendanceRow[],
) {
  return rows.map((row) => {
    const attendanceId = row.attendanceId ?? row.id;

    if (attendanceId === undefined) {
      throw new Error("Trackr attendance row was missing an attendance id.");
    }

    const name = normalizeAttendanceName(
      row.user?.name ?? row.name ?? `Unknown user ${String(attendanceId)}`,
    );

    return {
      attendanceId,
      userId: row.user?.id ?? row.userId ?? undefined,
      name,
      currentStatusId:
        row.statusId ??
        (typeof row.status === "object" ? row.status.id : undefined),
      currentStatusName: getTrackrRowStatusName(row),
      currentRemarks: row.remarks?.trim() || undefined,
    } satisfies NormalizedTrackrAttendanceRow;
  });
}
