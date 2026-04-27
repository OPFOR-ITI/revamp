import type { Doc } from "../../../convex/_generated/dataModel";
import type { Status } from "@/lib/constants";

export type ParadeStateRecordDoc = Doc<"paradeStateRecords">;
export type AppUserDoc = Doc<"appUsers">;
export type ActiveStatusSummary = {
  status: Status;
  customStatus?: string;
};

export type CurrentStateRow = {
  personnelKey: string;
  rank: string;
  name: string;
  platoon: string;
  designation: string;
  activeStatuses: ActiveStatusSummary[];
  activeRecordCount: number;
  hasParadeStateImpact: boolean;
  records: ParadeStateRecordDoc[];
};
