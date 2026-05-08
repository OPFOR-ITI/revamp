import type { Doc } from "../../../convex/_generated/dataModel";
import type {
  ConductAttendanceReason,
  ConductNonPresentReason,
} from "@/lib/conduct-attendance";
import type {
  ConductWhatsappData,
  ConductWhatsappSection,
} from "@/lib/conduct-whatsapp";

export type ConductDoc = Doc<"conducts">;

export type ConductSnapshotStatus =
  | "ready"
  | "canInitializeToday"
  | "futureLocked"
  | "pastLocked";

export type ConductNominalRollSeed = {
  personnelKey: string;
  rank: string;
  name: string;
  platoon: string;
};

export type ConductListItem = ConductDoc & {
  nonPresentCount: number;
  participantCount: number | null;
  nominalRollCount: number | null;
  snapshotStatus: ConductSnapshotStatus;
  hasAttendance: boolean;
  canPreviewWhatsapp: boolean;
};

export type ConductListForDateResult = {
  snapshotSummary: {
    nominalRollCount: number;
    snapshotStatus: ConductSnapshotStatus;
  };
  conducts: ConductListItem[];
};

export type ConductAttendanceSnapshotRow = {
  personnelKey: string;
  rank: string;
  name: string;
  platoon: string;
};

export type ConductAttendanceDraftEntry = {
  personnelKey: string;
  reason: ConductNonPresentReason;
  remarks?: string;
};

export type ConductAttendanceEditorState = {
  conduct: ConductDoc;
  snapshotStatus: ConductSnapshotStatus;
  snapshotRows: ConductAttendanceSnapshotRow[];
  attendanceEntries: ConductAttendanceDraftEntry[];
  attendanceInitialized: boolean;
  counts: {
    nominalRollCount: number;
    nonPresentCount: number;
    presentCount: number;
  };
};

export type ConductAttendanceDraftReason = ConductAttendanceReason;
export type ConductAttendancePersistedReason = ConductNonPresentReason;

export type { ConductWhatsappData, ConductWhatsappSection };
