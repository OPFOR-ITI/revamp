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
export type ConductNominalRollSnapshotDoc = Doc<"conductNominalRollSnapshots">;
export type ConductAbsenteeDoc = Doc<"conductAbsentees">;
export type ConductAttendanceEntryDoc = Doc<"conductAttendanceEntries">;

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
  whatsappData: ConductWhatsappData | null;
};

export type ConductAttendanceEditorState = {
  conduct: ConductDoc;
  snapshotStatus: ConductSnapshotStatus;
  snapshotRows: ConductNominalRollSnapshotDoc[];
  attendanceEntries: ConductAttendanceEntryDoc[];
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
