import type { Doc } from "../../../convex/_generated/dataModel";
import type { Status } from "@/lib/constants";

export type ParadeStateRecordDoc = Doc<"paradeStateRecords">;
export type AppUserDoc = Doc<"appUsers">;

export type CurrentStateRow = {
  personnelKey: string;
  rank: string;
  name: string;
  platoon: string;
  designation: string;
  activeStatuses: Status[];
  activeRecordCount: number;
  hasParadeStateImpact: boolean;
  records: ParadeStateRecordDoc[];
};
