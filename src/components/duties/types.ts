import type { Doc } from "../../../convex/_generated/dataModel";
import type { DutyAssignmentFormValues } from "@/lib/duties";

export type DutyAssignmentDoc = Doc<"dutyAssignments">;
export type DutyAssignmentFormData = DutyAssignmentFormValues;

export type DutyCalendarDayGroup = {
  date: Date;
  dateKey: string;
  inCurrentMonth: boolean;
  isToday: boolean;
  assignments: DutyAssignmentDoc[];
};
