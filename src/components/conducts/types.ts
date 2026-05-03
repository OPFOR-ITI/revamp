import type { Doc } from "../../../convex/_generated/dataModel";
import type {
  ConductWhatsappData,
  ConductWhatsappSection,
} from "@/lib/conduct-whatsapp";

export type ConductDoc = Doc<"conducts">;
export type ConductNominalRollSnapshotDoc = Doc<"conductNominalRollSnapshots">;
export type ConductAbsenteeDoc = Doc<"conductAbsentees">;

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
  absenteeCount: number;
  participantCount: number | null;
  nominalRollCount: number | null;
  snapshotStatus: ConductSnapshotStatus;
  hasAttendance: boolean;
  whatsappData: ConductWhatsappData | null;
};

export type ConductAttendanceState = {
  conduct: ConductDoc;
  snapshotStatus: ConductSnapshotStatus;
  platoonOptions: string[];
  snapshotRows: ConductNominalRollSnapshotDoc[];
  absenteePersonnelKeys: string[];
  attendanceInitialized: boolean;
};

export type { ConductWhatsappData, ConductWhatsappSection };
