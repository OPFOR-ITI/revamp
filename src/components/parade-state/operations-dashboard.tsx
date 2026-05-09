"use client";

import { format, parseISO } from "date-fns";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useConvex, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  CalendarDays,
  ChevronsUpDown,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  X,
  EllipsisVertical,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { StatusBadge } from "@/components/parade-state/status-badge";
import { ParadeReportModal } from "@/components/parade-state/parade-report-modal";
import {
  type CurrentStateRow,
  type ParadeStateRecordDoc,
} from "@/components/parade-state/types";
import { BulkSelectionList } from "@/components/parade-state/bulk-selection-list";
import { PersonnelCombobox } from "@/components/parade-state/personnel-combobox";
import { PersonnelMultiCombobox } from "@/components/personnel/personnel-multi-combobox";
import { PersonnelPreview } from "@/components/parade-state/personnel-preview";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Form,
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DateStepperField } from "@/components/ui/date-stepper-field";
import { TimePicker } from "@/components/ui/time-picker";
import {
  APP_USER_PLATOON_VALUES,
  DUPLICATE_STATUS_RECORD_MESSAGE,
  MAX_CUSTOM_STATUS_LENGTH,
  MAX_REMARKS_LENGTH,
  OTHER_STATUS_VALUE,
  PERSONNEL_ROUTE_PATH,
  STATUS_VALUES,
  formatStatusLabel,
  getStatusRecordPeriodConfig,
  isMaStatus,
  isOtherStatus,
  isPermanentRecord,
  shouldShowOutOfCampToggle,
  type AppUserPlatoon,
  type Status,
  type UserRole,
} from "@/lib/constants";
import {
  addDaysToDateString,
  getDayOffsetBetweenDates,
  formatDateLabel,
  formatTimestampLabel,
  MA_TIME_MINUTE_STEP,
  MA_TIME_WINDOW_END,
  MA_TIME_WINDOW_START,
  getTemporalBucketForDayRange,
  getTodaySingaporeDateString,
  getTodaySingaporeDayIndex,
  isValidMaTimeSlot,
  isValidTimeHHmm,
  TemporalBucket,
  TEMPORAL_BUCKET_COLORS,
} from "@/lib/date";
import { authClient } from "@/lib/auth-client";
import { hasPermission } from "@/lib/access-control";
import {
  formatDesignation,
  personnelRecordSchema,
  type PersonnelRecord,
} from "@/lib/personnel";
import { getPrimaryNavGroups } from "@/components/layout/app-navigation";
import { AppSidebarNav } from "@/components/layout/app-sidebar-nav";

type RecordPeriodFormValues = {
  status: Status;
  customStatus?: string;
  isPermanent: boolean;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
};

function addRecordFormIssues(
  values: RecordPeriodFormValues,
  ctx: z.RefinementCtx,
) {
  const { fixedDurationDays } = getStatusRecordPeriodConfig(values.status);

  if (fixedDurationDays === undefined) {
    if (!values.isPermanent && !values.endDate?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date is required unless the status is permanent.",
      });
    }

    if (
      !values.isPermanent &&
      values.endDate?.trim() &&
      values.endDate < values.startDate
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date must be on or after the start date.",
      });
    }
  }

  if (values.status === OTHER_STATUS_VALUE && !values.customStatus?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["customStatus"],
      message: "Enter the custom status for Others.",
    });
  }

  if (isMaStatus(values.status)) {
    const startTime = values.startTime?.trim() ?? "";
    const endTime = values.endTime?.trim() ?? "";

    if (!startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startTime"],
        message: "Start time is required for MA.",
      });
    } else if (!isValidTimeHHmm(startTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startTime"],
        message: 'Use "HHmm" format, for example 0830.',
      });
    } else if (!isValidMaTimeSlot(startTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startTime"],
        message: "Choose a 10-minute slot from 0600 to 1900.",
      });
    }

    if (!endTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "End time is required for MA.",
      });
    } else if (!isValidTimeHHmm(endTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: 'Use "HHmm" format, for example 1745.',
      });
    } else if (!isValidMaTimeSlot(endTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "Choose a 10-minute slot from 0600 to 1900.",
      });
    }

    if (isValidTimeHHmm(startTime) && isValidTimeHHmm(endTime) && endTime < startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "End time must be on or after the start time.",
      });
    }
  }
}

function getFixedDurationEndDate(status: Status, startDate: string) {
  const { fixedDurationDays } = getStatusRecordPeriodConfig(status);

  if (fixedDurationDays === undefined || !startDate) {
    return undefined;
  }

  return addDaysToDateString(startDate, Math.max(fixedDurationDays - 1, 0));
}

function getResolvedRecordPeriodValues(values: RecordPeriodFormValues) {
  const fixedEndDate = getFixedDurationEndDate(values.status, values.startDate);

  if (fixedEndDate) {
    return {
      isPermanent: false,
      endDate: fixedEndDate,
    };
  }

  return {
    isPermanent: values.isPermanent,
    endDate: values.isPermanent ? undefined : values.endDate?.trim() || undefined,
  };
}

function getDuplicateStatusRecordErrorData(
  error: unknown,
): DuplicateStatusRecordErrorData | null {
  const data =
    typeof error === "object" && error !== null && "data" in error
      ? (error as { data?: unknown }).data
      : null;

  if (
    typeof data === "object" &&
    data !== null &&
    "code" in data &&
    "message" in data &&
    "recordId" in data &&
    data.code === "DUPLICATE_STATUS_RECORD" &&
    typeof data.message === "string" &&
    typeof data.recordId === "string"
  ) {
    return data as DuplicateStatusRecordErrorData;
  }

  return null;
}

function getRecordMutationErrorMessage(error: unknown, fallback: string) {
  const duplicateError = getDuplicateStatusRecordErrorData(error);
  if (duplicateError) {
    return duplicateError.message;
  }

  if (!(error instanceof Error)) {
    return fallback;
  }

  if (error.message.includes(DUPLICATE_STATUS_RECORD_MESSAGE)) {
    return DUPLICATE_STATUS_RECORD_MESSAGE;
  }

  return error.message;
}

const recordFormSchema = z
  .object({
    personnelKey: z.string().optional(),
    status: z.enum(STATUS_VALUES),
    customStatus: z
      .string()
      .max(
        MAX_CUSTOM_STATUS_LENGTH,
        `Custom status must be ${MAX_CUSTOM_STATUS_LENGTH} characters or fewer.`,
      )
      .optional(),
    affectParadeState: z.boolean().optional(),
    isPermanent: z.boolean(),
    startDate: z.string().min(1, "Start date is required."),
    endDate: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    remarks: z
      .string()
      .max(MAX_REMARKS_LENGTH, `Remarks must be ${MAX_REMARKS_LENGTH} characters or fewer.`)
      .optional(),
  })
  .superRefine(addRecordFormIssues);

const adjustEndDateSchema = z.object({
  endDate: z.string().min(1, "End date is required."),
});

type RecordFormValues = z.infer<typeof recordFormSchema>;
type AdjustEndDateValues = z.infer<typeof adjustEndDateSchema>;
type DashboardView = "current-state" | "record-log";
type RecordDialogMode = "add" | "edit";
type RecordDialogState =
  | { mode: "add" }
  | { mode: "edit"; record: ParadeStateRecordDoc };
type PersonnelRouteError = { error?: { code?: string; message?: string } };
type DuplicateStatusRecordErrorData = {
  code: "DUPLICATE_STATUS_RECORD";
  message: string;
  recordId: Id<"paradeStateRecords">;
};
const MAX_CURRENT_STATE_NAME_LENGTH = 50;

function getEmptyRecordFormValues(): RecordFormValues {
  return {
    personnelKey: "",
    status: STATUS_VALUES[0],
    customStatus: "",
    affectParadeState: false,
    isPermanent: false,
    startDate: getTodaySingaporeDateString(),
    endDate: "",
    startTime: "",
    endTime: "",
    remarks: "",
  };
}

function getRecordFormValuesFromRecord(
  record: ParadeStateRecordDoc,
): RecordFormValues {
  return {
    personnelKey: record.personnelKey,
    status: record.status,
    customStatus: record.customStatus ?? "",
    affectParadeState: record.affectParadeState,
    isPermanent: isPermanentRecord(record),
    startDate: record.startDate,
    endDate: record.endDate ?? "",
    startTime: record.startTime ?? "",
    endTime: record.endTime ?? "",
    remarks: record.remarks ?? "",
  };
}

function getRecordTemporalBucket(record: ParadeStateRecordDoc) {
  return getTemporalBucketForDayRange(
    record.startDay,
    record.endDay,
    getTodaySingaporeDayIndex(),
  );
}

function TemporalBucketDot({ bucket }: { bucket: TemporalBucket }) {
  return (
    <Tooltip>
      <TooltipTrigger
        className={`inline-block size-2 shrink-0 cursor-default rounded-full ${TEMPORAL_BUCKET_COLORS[bucket]}`}
        aria-label={bucket}
      />
      <TooltipContent side="top">{bucket} Status</TooltipContent>
    </Tooltip>
  );
}

function formatRemarks(value?: string) {
  return value?.trim() ? value.trim() : "No remarks";
}

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength
    ? `${value.slice(0, Math.max(maxLength - 1, 0)).trimEnd()}…`
    : value;
}

function formatRecordPeriod(record: {
  startDate: string;
  endDate?: string;
  isPermanent?: boolean;
  startTime?: string;
  endTime?: string;
}) {
  if (isPermanentRecord(record)) {
    return "Permanent";
  }

  const dateLabel = `${formatDateLabel(record.startDate)} to ${formatDateLabel(record.endDate ?? record.startDate)}`;
  const timeLabel =
    record.startTime && record.endTime
      ? `, ${record.startTime}-${record.endTime}hrs`
      : "";

  return `${dateLabel}${timeLabel}`;
}

function ImpactBadge({ affectsParadeState }: { affectsParadeState: boolean }) {
  return (
    <Badge
      variant={affectsParadeState ? "outline" : "default"}
      className={affectsParadeState ? "" : "bg-emerald-800 text-white"}
    >
      {affectsParadeState ? "Out of Camp" : "In Camp"}
    </Badge>
  );
}

function CompactCalendarFilterField({
  id,
  label,
  value,
  onChange,
  placeholder,
  minDate,
  maxDate,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  minDate?: string;
  maxDate?: string;
}) {
  const selectedDate = value ? parseISO(value) : undefined;

  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-zinc-500">
        {label}
      </Label>
      <Popover>
        <PopoverTrigger
          id={id}
          className={`${buttonVariants({ variant: "ghost" })} h-full min-w-[8.75rem] justify-between rounded-sm px-2 text-sm font-normal shadow-none hover:bg-zinc-50 ${value ? "text-zinc-900" : "text-muted-foreground"}`}
        >
          <span>{value ? formatDateLabel(value) : placeholder}</span>
          <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(nextDate) => {
              if (nextDate) {
                onChange(format(nextDate, "yyyy-MM-dd"));
              }
            }}
            disabled={(date) => {
              const nextValue = format(date, "yyyy-MM-dd");
              return (
                (minDate ? nextValue < minDate : false) ||
                (maxDate ? nextValue > maxDate : false)
              );
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function PermanentStatusField({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <FormItem>
      <div className="flex h-full items-center justify-between rounded-xl border border-border px-3 py-2.5">
        <FormLabel>Permanent?</FormLabel>
        <div className="flex items-center gap-2">
          <Badge variant={checked ? "default" : "outline"} className={checked ? "bg-emerald-800 text-white" : ""}>
            {checked ? "Permanent" : "Dated"}
          </Badge>
          <Switch checked={checked} onCheckedChange={onCheckedChange} />
        </div>
      </div>
    </FormItem>
  );
}

function getViewerInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getViewerDefaultPlatoon(
  viewer: { name: string; email: string; platoon?: AppUserPlatoon },
) {
  return viewer.platoon ?? null;
}

function getDaysOffsetInputValue(startDate: string, endDate?: string) {
  if (!startDate || !endDate) {
    return "";
  }

  const inclusiveDuration = getDayOffsetBetweenDates(startDate, endDate) + 1;
  return inclusiveDuration > 0 ? String(inclusiveDuration) : "";
}

function StatusDaysField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FormItem>
      <FormLabel htmlFor={id}>Days</FormLabel>
      <Input
        id={id}
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 4))}
        placeholder="0"
        className="h-10"
      />
    </FormItem>
  );
}

function StatusTimeField({
  id,
  label,
  value,
  onChange,
  minTime,
  maxTime,
  minuteStep,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  minTime: string;
  maxTime: string;
  minuteStep: number;
  error?: string;
}) {
  return (
    <FormItem>
      <FormLabel htmlFor={id}>{label}</FormLabel>
      <TimePicker
        id={id}
        value={value}
        onChange={onChange}
        minTime={minTime}
        maxTime={maxTime}
        minuteStep={minuteStep}
      />
      <FormMessage>{error}</FormMessage>
    </FormItem>
  );
}

function RecordCard({
  record,
  onEdit,
  onDelete,
  onAdjustEndDate,
}: {
  record: ParadeStateRecordDoc;
  onEdit?: () => void;
  onDelete?: () => void;
  onAdjustEndDate?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={record.status}
              customStatus={record.customStatus}
            />
            {isPermanentRecord(record) ? <Badge variant="outline">Permanent</Badge> : null}
            <ImpactBadge affectsParadeState={record.affectParadeState} />
          </div>
          <p className="text-sm font-medium text-zinc-900">
            {formatRecordPeriod(record)}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="text-right text-xs text-muted-foreground">
            <p>Submitted by {record.submittedByName}</p>
            <p>{formatTimestampLabel(record.createdAt)}</p>
          </div>
          {onEdit && onDelete && onAdjustEndDate ? (
            <RecordActionsMenu
              record={record}
              onEdit={onEdit}
              onDelete={onDelete}
              onAdjustEndDate={onAdjustEndDate}
            />
          ) : null}
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-600">
        {formatRemarks(record.remarks)}
      </p>
    </div>
  );
}

function OtherStatusFields({
  customStatus,
  customStatusError,
  onCustomStatusChange,
  affectParadeState,
  onAffectParadeStateChange,
}: {
  customStatus: string;
  customStatusError?: string;
  onCustomStatusChange: (value: string) => void;
  affectParadeState: boolean;
  onAffectParadeStateChange: (value: boolean) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FormItem>
        <FormLabel htmlFor="custom-status">Custom status</FormLabel>
        <FormControl>
          <Input
            id="custom-status"
            value={customStatus}
            maxLength={MAX_CUSTOM_STATUS_LENGTH}
            placeholder="Type the status to display"
            onChange={(event) => onCustomStatusChange(event.target.value)}
          />
        </FormControl>
        <FormMessage>{customStatusError}</FormMessage>
      </FormItem>

      <FormItem>
        <div className="flex h-full items-center justify-between rounded-xl border border-border px-3 py-2.5">
          <FormLabel>Out of camp?</FormLabel>
          <div className="flex items-center gap-2">
            <ImpactBadge affectsParadeState={affectParadeState} />
            <Switch
              checked={affectParadeState}
              onCheckedChange={onAffectParadeStateChange}
            />
          </div>
        </div>
      </FormItem>
    </div>
  );
}

function RecordDialog({
  open,
  onOpenChange,
  mode,
  record,
  personnel,
  personnelError,
  personnelLoading,
  submittedBy,
  onEditDuplicateRecord,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: RecordDialogMode;
  record: ParadeStateRecordDoc | null;
  personnel: PersonnelRecord[];
  personnelError: string | null;
  personnelLoading: boolean;
  submittedBy: string;
  onEditDuplicateRecord: (recordId: Id<"paradeStateRecords">) => void;
}) {
  const createRecord = useMutation(api.paradeState.createRecord);
  const updateRecord = useMutation(api.paradeState.updateRecord);
  const form = useForm<RecordFormValues>({
    resolver: zodResolver(recordFormSchema),
    defaultValues: getEmptyRecordFormValues(),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkPersonnelKeys, setBulkPersonnelKeys] = useState<string[]>([]);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const selectedPersonnelKey = useWatch({
    control: form.control,
    name: "personnelKey",
  });
  const selectedStatus = useWatch({
    control: form.control,
    name: "status",
  });
  const customStatus = useWatch({
    control: form.control,
    name: "customStatus",
  });
  const affectParadeState = useWatch({
    control: form.control,
    name: "affectParadeState",
  });
  const isPermanent = useWatch({
    control: form.control,
    name: "isPermanent",
  });
  const startDate = useWatch({
    control: form.control,
    name: "startDate",
  });
  const endDate = useWatch({
    control: form.control,
    name: "endDate",
  });
  const startTime = useWatch({
    control: form.control,
    name: "startTime",
  });
  const endTime = useWatch({
    control: form.control,
    name: "endTime",
  });
  const selectedStatusRecordPeriodConfig = getStatusRecordPeriodConfig(selectedStatus);
  const fixedDurationDays = selectedStatusRecordPeriodConfig.fixedDurationDays;
  const selectedPersonnel = personnel.find(
    (person) => person.personnelKey === selectedPersonnelKey,
  );
  const pickerDisabled =
    personnelLoading || !!personnelError || personnel.length === 0;
  const isAddMode = mode === "add";

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) {
      form.reset(getEmptyRecordFormValues());
      setBulkMode(false);
      setBulkPersonnelKeys([]);
      setBulkError(null);
      return;
    }

    if (mode === "edit" && record) {
      form.reset(getRecordFormValuesFromRecord(record));
      return;
    }

    form.reset(getEmptyRecordFormValues());
  }, [form, mode, open, record]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!isOtherStatus(selectedStatus)) {
      form.setValue("customStatus", "", {
        shouldDirty: false,
        shouldValidate: false,
      });
    }

    if (!shouldShowOutOfCampToggle(selectedStatus) || isMaStatus(selectedStatus)) {
      form.setValue("affectParadeState", false, {
        shouldDirty: false,
        shouldValidate: false,
      });
    }

    if (!isMaStatus(selectedStatus)) {
      form.setValue("startTime", "", {
        shouldDirty: false,
        shouldValidate: false,
      });
      form.setValue("endTime", "", {
        shouldDirty: false,
        shouldValidate: false,
      });
    }
  }, [form, selectedStatus]);

  useEffect(() => {
    const fixedEndDate = getFixedDurationEndDate(selectedStatus, startDate);

    if (!fixedEndDate) {
      return;
    }

    form.setValue("isPermanent", false, {
      shouldDirty: false,
      shouldValidate: true,
    });
    form.setValue("endDate", fixedEndDate, {
      shouldDirty: false,
      shouldValidate: true,
    });
  }, [form, selectedStatus, startDate]);

  const dayOffsetInput = isPermanent
    ? ""
    : getDaysOffsetInputValue(startDate, endDate);

  function handleStartDateChange(nextValue: string) {
    form.setValue("startDate", nextValue, {
      shouldDirty: true,
      shouldValidate: true,
    });

    const fixedEndDate = getFixedDurationEndDate(selectedStatus, nextValue);

    if (fixedEndDate) {
      form.setValue("endDate", fixedEndDate, {
        shouldDirty: false,
        shouldValidate: true,
      });
      return;
    }

    if (!dayOffsetInput) {
      return;
    }

    const durationDays = Number(dayOffsetInput);
    form.setValue(
      "endDate",
      addDaysToDateString(nextValue, Math.max(durationDays - 1, 0)),
      {
        shouldDirty: true,
        shouldValidate: true,
      },
    );
  }

  function handleEndDateChange(nextValue: string) {
    form.setValue("endDate", nextValue, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function handleDayOffsetChange(nextValue: string) {
    form.setValue(
      "endDate",
      nextValue ? addDaysToDateString(startDate, Math.max(Number(nextValue) - 1, 0)) : "",
      {
        shouldDirty: true,
        shouldValidate: true,
      },
    );
  }

  async function onSubmit(values: RecordFormValues) {
    setIsSubmitting(true);
    setBulkError(null);

    try {
      const resolvedPeriod = getResolvedRecordPeriodValues(values);

      if (isAddMode && bulkMode) {
        const selectedList = bulkPersonnelKeys
          .map((key) => personnel.find((p) => p.personnelKey === key))
          .filter((p): p is PersonnelRecord => p !== undefined);

        if (selectedList.length === 0) {
          setBulkError("Select at least one serviceman.");
          return;
        }

        let successCount = 0;
        const duplicateNames: string[] = [];
        const failedNames: string[] = [];

        for (const person of selectedList) {
          try {
            await createRecord({
              personnelKey: person.personnelKey,
              rank: person.rank,
              name: person.name,
              platoon: person.platoon,
              designation: person.designation,
              status: values.status,
              customStatus: isOtherStatus(values.status)
                ? values.customStatus?.trim() || undefined
                : undefined,
              affectParadeState: shouldShowOutOfCampToggle(values.status)
                ? values.affectParadeState
                : undefined,
              isPermanent: resolvedPeriod.isPermanent,
              startDate: values.startDate,
              endDate: resolvedPeriod.endDate,
              startTime: isMaStatus(values.status)
                ? values.startTime?.trim()
                : undefined,
              endTime: isMaStatus(values.status)
                ? values.endTime?.trim()
                : undefined,
              remarks: values.remarks?.trim() ? values.remarks.trim() : undefined,
            });
            successCount++;
          } catch (error) {
            const message = getRecordMutationErrorMessage(
              error,
              "Unable to save record.",
            );

            if (message === DUPLICATE_STATUS_RECORD_MESSAGE) {
              duplicateNames.push(person.name);
            } else {
              failedNames.push(person.name);
            }
          }
        }

        if (duplicateNames.length === 0 && failedNames.length === 0) {
          toast.success(
            `Created ${successCount} parade-state record${successCount === 1 ? "" : "s"}.`,
          );
        } else if (duplicateNames.length > 0 && failedNames.length === 0) {
          toast.error(
            `${DUPLICATE_STATUS_RECORD_MESSAGE} Duplicate${duplicateNames.length === 1 ? "" : "s"}: ${duplicateNames.join(", ")}`,
          );
        } else {
          toast.error(
            `Created ${successCount} of ${selectedList.length}. ${duplicateNames.length > 0 ? `Duplicates: ${duplicateNames.join(", ")}. ` : ""}Failed for: ${failedNames.join(", ")}`,
          );
        }

        onOpenChange(false);
      } else if (isAddMode) {
        if (!selectedPersonnel) {
          form.setError("personnelKey", {
            message: "Select a serviceman before saving.",
          });
          return;
        }

        await createRecord({
          personnelKey: selectedPersonnel.personnelKey,
          rank: selectedPersonnel.rank,
          name: selectedPersonnel.name,
          platoon: selectedPersonnel.platoon,
          designation: selectedPersonnel.designation,
          status: values.status,
          customStatus: isOtherStatus(values.status)
            ? values.customStatus?.trim() || undefined
            : undefined,
          affectParadeState: shouldShowOutOfCampToggle(values.status)
            ? values.affectParadeState
            : undefined,
          isPermanent: resolvedPeriod.isPermanent,
          startDate: values.startDate,
          endDate: resolvedPeriod.endDate,
          startTime: isMaStatus(values.status)
            ? values.startTime?.trim()
            : undefined,
          endTime: isMaStatus(values.status) ? values.endTime?.trim() : undefined,
          remarks: values.remarks?.trim() ? values.remarks.trim() : undefined,
        });

        toast.success("Parade-state record created.");
        onOpenChange(false);
      } else {
        if (!record) {
          return;
        }

        await updateRecord({
          recordId: record._id,
          status: values.status,
          customStatus: isOtherStatus(values.status)
            ? values.customStatus?.trim() || undefined
            : undefined,
          affectParadeState: shouldShowOutOfCampToggle(values.status)
            ? values.affectParadeState
            : undefined,
          isPermanent: resolvedPeriod.isPermanent,
          startDate: values.startDate,
          endDate: resolvedPeriod.endDate,
          startTime: isMaStatus(values.status)
            ? values.startTime?.trim()
            : undefined,
          endTime: isMaStatus(values.status) ? values.endTime?.trim() : undefined,
          remarks: values.remarks?.trim() ? values.remarks.trim() : undefined,
        });

        toast.success("Record updated.");
        onOpenChange(false);
      }
    } catch (error) {
      const duplicateError = isAddMode
        ? getDuplicateStatusRecordErrorData(error)
        : null;

      if (duplicateError && !bulkMode) {
        toast.error(duplicateError.message, {
          action: {
            label: "Edit",
            onClick: () => onEditDuplicateRecord(duplicateError.recordId),
          },
        });
      } else {
        toast.error(
          getRecordMutationErrorMessage(
            error,
            isAddMode ? "Unable to save record." : "Unable to update record.",
          ),
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const previewPersonnel = record
    ? {
        personnelKey: record.personnelKey,
        rank: record.rank,
        name: record.name,
        platoon: record.platoon,
        designation: record.designation,
        label: `${record.rank} ${record.name} / ${record.platoon} / ${formatDesignation(record.designation)}`,
      }
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-1rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isAddMode ? "Add Personnel Status" : "Edit Record"}</DialogTitle>
          <DialogDescription>
            {isAddMode
              ? bulkMode
                ? "Select multiple servicemen to apply the same status to all of them."
                : "Create a new personnel status record."
              : "Update status, dates, or remarks. Serviceman identity stays locked to preserve the historical snapshot."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
            {isAddMode && personnelError ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                {personnelError} Existing records still work, but the personnel
                picker is disabled until refresh succeeds.
              </div>
            ) : null}

            {isAddMode ? (
              <Tabs
                defaultValue="single"
                onValueChange={(value) => {
                  const isBulk = value === "bulk";
                  setBulkMode(isBulk);
                  setBulkError(null);
                }}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="single">Single</TabsTrigger>
                  <TabsTrigger value="bulk">Bulk</TabsTrigger>
                </TabsList>
                <TabsContent value="single">
                  <FormItem>
                    <FormLabel>Serviceman</FormLabel>
                    <PersonnelCombobox
                      personnel={personnel}
                      value={selectedPersonnelKey ?? ""}
                      onChange={(nextValue) =>
                        form.setValue("personnelKey", nextValue, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                      disabled={pickerDisabled}
                    />
                    <FormMessage>{form.formState.errors.personnelKey?.message}</FormMessage>
                  </FormItem>
                </TabsContent>
                <TabsContent value="bulk">
                  <div className="grid gap-4">
                    <FormItem>
                      <FormLabel>Servicemen</FormLabel>
                      <PersonnelMultiCombobox
                        personnel={personnel}
                        value={bulkPersonnelKeys}
                        onChange={(nextValue) => {
                          setBulkPersonnelKeys(nextValue);
                          setBulkError(null);
                        }}
                        disabled={pickerDisabled}
                        emptySelectionLabel="Select servicemen"
                        getSingleSelectionLabel={(person) => person.label}
                        getMultiSelectionLabel={(count) =>
                          `${count} servicemen selected`
                        }
                        searchPlaceholder="Search rank, name, platoon, or designation..."
                        getSearchText={(person) =>
                          `${person.rank} ${person.name} ${person.platoon} ${person.designation}`
                        }
                        getSecondaryText={(person) =>
                          `${person.platoon} / ${formatDesignation(person.designation)}`
                        }
                        enablePlatoonFilter
                      />
                      {bulkError ? (
                        <p className="text-[0.8rem] font-medium text-destructive">
                          {bulkError}
                        </p>
                      ) : null}
                    </FormItem>
                  </div>

                  <BulkSelectionList
                    personnel={personnel}
                    selectedKeys={bulkPersonnelKeys}
                    onRemove={(key) => {
                      setBulkPersonnelKeys((prev) =>
                        prev.filter((k) => k !== key),
                      );
                    }}
                    className="mt-3"
                  />
                </TabsContent>
              </Tabs>
            ) : (
              <PersonnelPreview personnel={previewPersonnel} />
            )}

            <div
              className={
                selectedStatusRecordPeriodConfig.showPermanentStatusToggle
                  ? "grid gap-5 grid-cols-2"
                  : "grid gap-5"
              }
            >
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select
                  value={selectedStatus}
                  onValueChange={(value) =>
                    form.setValue("status", value as Status, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_VALUES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage>{form.formState.errors.status?.message}</FormMessage>
              </FormItem>

              {selectedStatusRecordPeriodConfig.showPermanentStatusToggle ? (
                <PermanentStatusField
                  checked={!!isPermanent}
                  onCheckedChange={(value) =>
                    form.setValue("isPermanent", value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
              ) : null}
            </div>

            {isOtherStatus(selectedStatus) ? (
              <OtherStatusFields
                customStatus={customStatus ?? ""}
                customStatusError={form.formState.errors.customStatus?.message}
                onCustomStatusChange={(value) =>
                  form.setValue("customStatus", value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                affectParadeState={!!affectParadeState}
                onAffectParadeStateChange={(value) =>
                  form.setValue("affectParadeState", value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
            ) : shouldShowOutOfCampToggle(selectedStatus) && !isMaStatus(selectedStatus) ? (
              <FormItem>
                <div className="flex h-full items-center justify-between rounded-xl border border-border px-3 py-2.5">
                  <FormLabel>Out of camp?</FormLabel>
                  <div className="flex items-center gap-2">
                    <ImpactBadge affectsParadeState={!!affectParadeState} />
                    <Switch
                      checked={!!affectParadeState}
                      onCheckedChange={(value) =>
                        form.setValue("affectParadeState", value, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                    />
                  </div>
                </div>
              </FormItem>
            ) : null}

            <div
              className={
                fixedDurationDays === undefined
                  ? "grid gap-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)] sm:items-start"
                  : isMaStatus(selectedStatus)
                    ? "grid gap-5 sm:grid-cols-2 sm:items-start"
                    : "grid gap-5"
              }
            >
              {fixedDurationDays !== undefined ? (
                <>
                  <DateStepperField
                    id={`${mode}-start-date`}
                    label="Start date"
                    value={startDate}
                    onChange={handleStartDateChange}
                    error={form.formState.errors.startDate?.message}
                  />
                  {isMaStatus(selectedStatus) ? (
                    <div className="grid gap-2 grid-cols-2">
                      <StatusTimeField
                        id={`${mode}-ma-start-time`}
                        label="Start time"
                        value={startTime ?? ""}
                        minTime={MA_TIME_WINDOW_START}
                        maxTime={MA_TIME_WINDOW_END}
                        minuteStep={MA_TIME_MINUTE_STEP}
                        onChange={(value) =>
                          form.setValue("startTime", value, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                        error={form.formState.errors.startTime?.message}
                      />
                      <StatusTimeField
                        id={`${mode}-ma-end-time`}
                        label="End time"
                        value={endTime ?? ""}
                        minTime={MA_TIME_WINDOW_START}
                        maxTime={MA_TIME_WINDOW_END}
                        minuteStep={MA_TIME_MINUTE_STEP}
                        onChange={(value) =>
                          form.setValue("endTime", value, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                        error={form.formState.errors.endTime?.message}
                      />
                    </div>
                  ) : null}
                </>
              ) : isPermanent ? (
                <div className="flex items-center rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground sm:col-span-3">
                  {isAddMode
                    ? "No start or end date. Permanent statuses become active immediately and stay active until you edit the record later."
                    : "No start or end date. Turn off permanent status if you need this record to use a dated range."}
                </div>
              ) : (
                <>
                  <DateStepperField
                    id={`${mode}-start-date`}
                    label="Start date"
                    value={startDate}
                    onChange={handleStartDateChange}
                    error={form.formState.errors.startDate?.message}
                  />

                  <StatusDaysField
                    id={`${mode}-duration-days`}
                    value={dayOffsetInput}
                    onChange={handleDayOffsetChange}
                  />

                  <DateStepperField
                    id={`${mode}-end-date`}
                    label="End date"
                    value={endDate ?? ""}
                    onChange={handleEndDateChange}
                    minDate={startDate}
                    error={form.formState.errors.endDate?.message}
                  />
                </>
              )}
            </div>

            <FormItem>
              <FormLabel htmlFor={`${mode}-remarks`}>Remarks</FormLabel>
              <FormControl>
                <Textarea
                  id={`${mode}-remarks`}
                  rows={4}
                  placeholder="Optional supporting details"
                  {...form.register("remarks")}
                />
              </FormControl>
              {isAddMode ? (
                <FormDescription>
                  Optional. Up to {MAX_REMARKS_LENGTH} characters.
                </FormDescription>
              ) : null}
              <FormMessage>{form.formState.errors.remarks?.message}</FormMessage>
            </FormItem>

            <DialogFooter className="gap-2">
              {isAddMode ? (
                <p className="mr-auto hidden text-xs text-muted-foreground sm:block">
                  Submitted by {submittedBy}
                </p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || (isAddMode && pickerDisabled)}
                className="w-full sm:w-auto"
              >
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {isAddMode
                  ? bulkMode
                    ? bulkPersonnelKeys.length > 0
                      ? `Save ${bulkPersonnelKeys.length} record${bulkPersonnelKeys.length === 1 ? "" : "s"}`
                      : "Save records"
                    : "Save record"
                  : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function AdjustEndDateDialog({
  open,
  onOpenChange,
  record,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: ParadeStateRecordDoc | null;
}) {
  const adjustEndDate = useMutation(api.paradeState.adjustEndDate);
  const form = useForm<AdjustEndDateValues>({
    resolver: zodResolver(adjustEndDateSchema),
    defaultValues: {
      endDate: getTodaySingaporeDateString(),
    },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const endDate = useWatch({
    control: form.control,
    name: "endDate",
  });

  useEffect(() => {
    if (!record || isPermanentRecord(record)) {
      return;
    }

    const today = getTodaySingaporeDateString();
    form.reset({
      endDate: today >= record.startDate ? today : record.startDate,
    });
  }, [form, record]);

  const dayOffsetInput =
    record && !isPermanentRecord(record)
      ? getDaysOffsetInputValue(record.startDate, endDate)
      : "";

  function handleEndDateChange(nextValue: string) {
    form.setValue("endDate", nextValue, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function handleDayOffsetChange(nextValue: string) {
    if (!record || isPermanentRecord(record)) {
      return;
    }

    form.setValue(
      "endDate",
      nextValue
        ? addDaysToDateString(record.startDate, Math.max(Number(nextValue) - 1, 0))
        : "",
      {
        shouldDirty: true,
        shouldValidate: true,
      },
    );
  }

  async function onSubmit(values: AdjustEndDateValues) {
    if (!record) {
      return;
    }

    setIsSubmitting(true);

    try {
      await adjustEndDate({
        recordId: record._id,
        endDate: values.endDate,
      });
      toast.success("End date adjusted.");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to adjust the end date.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-1rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adjust End Date</DialogTitle>
          <DialogDescription>
            Dates are inclusive. Closing a record today keeps it active for today.
          </DialogDescription>
        </DialogHeader>

        {record ? (
          <Form {...form}>
            <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
                <p className="font-medium text-zinc-900">
                  {record.rank} {record.name}
                </p>
                <p className="mt-1 text-muted-foreground">
                  Current period: {formatRecordPeriod(record)}
                </p>
              </div>

              {isPermanentRecord(record) ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  Permanent records do not have an end date. Edit the record and
                  turn off permanent status first.
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] sm:items-start">
                  <DateStepperField
                    id="adjust-end-date"
                    label="New end date"
                    value={endDate}
                    onChange={handleEndDateChange}
                    minDate={record.startDate}
                    description="Dates are inclusive, so closing today keeps the record active for today."
                    error={form.formState.errors.endDate?.message}
                  />

                  <StatusDaysField
                    id="adjust-duration-days"
                    value={dayOffsetInput}
                    onChange={handleDayOffsetChange}
                  />
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || isPermanentRecord(record)}
                  className="w-full sm:w-auto"
                >
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  Update end date
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PersonnelRecordsSheet({
  open,
  onOpenChange,
  selectedRow,
  onEditRecord,
  onDeleteRecord,
  onAdjustEndDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRow: CurrentStateRow | null;
  onEditRecord: (record: ParadeStateRecordDoc) => void;
  onDeleteRecord: (record: ParadeStateRecordDoc) => void;
  onAdjustEndDate: (record: ParadeStateRecordDoc) => void;
}) {
  const records = useQuery(
    api.paradeState.listRecordsForPersonnel,
    selectedRow ? { personnelKey: selectedRow.personnelKey } : "skip",
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b border-border">
          <SheetTitle>
            {selectedRow ? `${selectedRow.rank} ${selectedRow.name}` : "Records"}
          </SheetTitle>
          <SheetDescription>
            {selectedRow
              ? `${selectedRow.platoon} / ${formatDesignation(selectedRow.designation)}`
              : "Active and historical records for the selected serviceman."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-4">
          {records === undefined ? (
            <>
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
            </>
          ) : records.length ? (
            records.map((record) => (
              <RecordCard
                key={record._id}
                record={record}
                onEdit={() => onEditRecord(record)}
                onDelete={() => onDeleteRecord(record)}
                onAdjustEndDate={() => onAdjustEndDate(record)}
              />
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              No records found for this serviceman.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RecordActionsMenu({
  record,
  onEdit,
  onDelete,
  onAdjustEndDate,
}: {
  record: ParadeStateRecordDoc;
  onEdit: () => void;
  onDelete: () => void;
  onAdjustEndDate: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={buttonVariants({
          variant: "outline",
          size: "sm",
        })}
      >
        <EllipsisVertical/>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
        {!isPermanentRecord(record) ? (
          <DropdownMenuItem onClick={onAdjustEndDate}>
            Adjust end date
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CurrentStateMobileCard({
  row,
  onViewRecords,
}: {
  row: CurrentStateRow;
  onViewRecords: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/90 p-4 md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-zinc-950">
            {row.rank} {row.name}
          </p>
          <p className="text-sm text-muted-foreground">
            {row.platoon} / {formatDesignation(row.designation)}
          </p>
        </div>
        <Badge
          variant={row.hasParadeStateImpact ? "outline" : "default"}
          className={row.hasParadeStateImpact ? "" : "bg-emerald-800 text-white"}
        >
          {row.hasParadeStateImpact ? "Out of Camp" : "In Camp"}
        </Badge>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {row.activeStatuses.map((status) => (
          <StatusBadge
            key={`${row.personnelKey}-${status.status}-${status.customStatus ?? ""}`}
            status={status.status}
            customStatus={status.customStatus}
          />
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          {row.activeRecordCount} active record{row.activeRecordCount === 1 ? "" : "s"}
        </span>
        <Button variant="outline" size="sm" onClick={onViewRecords}>
          View records
        </Button>
      </div>
    </div>
  );
}

function RecordLogMobileCard({
  record,
  onEdit,
  onDelete,
  onAdjustEndDate,
}: {
  record: ParadeStateRecordDoc;
  onEdit: () => void;
  onDelete: () => void;
  onAdjustEndDate: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/90 p-4 md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-zinc-950">
            {record.rank} {record.name}
          </p>
          <p className="text-sm text-muted-foreground">
            {record.platoon} / {formatDesignation(record.designation)}
          </p>
        </div>
        <RecordActionsMenu
          record={record}
          onEdit={onEdit}
          onDelete={onDelete}
          onAdjustEndDate={onAdjustEndDate}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <StatusBadge
          status={record.status}
          customStatus={record.customStatus}
        />
        <Badge
          variant={record.affectParadeState ? "outline" : "default"}
          className={record.affectParadeState ? "" : "bg-emerald-800 text-white"}
        >
          {record.affectParadeState ? "Out of Camp" : "In Camp"}
        </Badge>
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <div className="relative">
          <p className="font-medium text-zinc-950">{formatRecordPeriod(record)}</p>
          <p className="text-muted-foreground">{formatRemarks(record.remarks)}</p>
          <span className="absolute right-0 top-0">
            <TemporalBucketDot bucket={getRecordTemporalBucket(record)} />
          </span>
        </div>
        <div className="text-muted-foreground">
          <p>Submitted by {record.submittedByName}</p>
          <p>{formatTimestampLabel(record.createdAt)}</p>
        </div>
      </div>
    </div>
  );
}

function DeleteRecordDialog({
  open,
  onOpenChange,
  record,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: ParadeStateRecordDoc | null;
  onDeleted: (record: ParadeStateRecordDoc) => void;
}) {
  const deleteRecord = useMutation(api.paradeState.deleteRecord);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleDelete() {
    if (!record) {
      return;
    }

    setIsSubmitting(true);

    try {
      await deleteRecord({ recordId: record._id });
      toast.success("Record deleted.");
      onDeleted(record);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete record.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-1rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Erase Record</DialogTitle>
          <DialogDescription>
            This <strong>PERMANENTLY erases</strong> the selected status log entry!
          </DialogDescription>
        </DialogHeader>

        {record ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <p className="font-medium text-zinc-950">
                {record.rank} {record.name}
              </p>
              <p className="mt-1 text-muted-foreground">
                {formatStatusLabel(record.status, record.customStatus)} ·{" "}
                {formatRecordPeriod(record)}
              </p>
              <p className="mt-1 text-muted-foreground">
                {formatRemarks(record.remarks)}
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void handleDelete()}
                disabled={isSubmitting}
                className="w-full sm:w-auto"
              >
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                Erase record
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function OperationsDashboard({
  initialView,
  viewer,
}: {
  initialView: DashboardView;
  viewer: {
    name: string;
    email: string;
    platoon?: AppUserPlatoon;
    roles: UserRole[];
  };
}) {
  const router = useRouter();
  const convex = useConvex();

  const [personnel, setPersonnel] = useState<PersonnelRecord[]>([]);
  const [personnelError, setPersonnelError] = useState<string | null>(null);
  const [personnelRefreshKey, setPersonnelRefreshKey] = useState(0);
  const [isPersonnelLoading, setIsPersonnelLoading] = useState(true);
  const [isParadeStateOpen, setIsParadeStateOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<CurrentStateRow | null>(null);
  const [recordDialogState, setRecordDialogState] =
    useState<RecordDialogState | null>(null);
  const [recordPendingDelete, setRecordPendingDelete] =
    useState<ParadeStateRecordDoc | null>(null);
  const [recordForEndDateAdjust, setRecordForEndDateAdjust] =
    useState<ParadeStateRecordDoc | null>(null);
  const [currentStateSearch, setCurrentStateSearch] = useState("");
  const deferredCurrentStateSearch = useDeferredValue(
    currentStateSearch.trim().toLowerCase(),
  );
  const [recordSearch, setRecordSearch] = useState("");
  const [debouncedRecordSearch, setDebouncedRecordSearch] = useState("");
  const [currentStatePlatoonFilter, setCurrentStatePlatoonFilter] = useState(
    () => getViewerDefaultPlatoon(viewer) ?? "all",
  );
  const [statusFilter, setStatusFilter] = useState<Status[]>([]);
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const [platoonFilter, setPlatoonFilter] = useState("all");
  const [recordFilterFromDate, setRecordFilterFromDate] = useState(
    getTodaySingaporeDateString(),
  );
  const [recordFilterToDate, setRecordFilterToDate] = useState("");
  const [activeView, setActiveView] = useState<DashboardView>(initialView);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedRecordSearch(recordSearch.trim().toLowerCase());
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [recordSearch]);

  const currentStateArgs = useMemo(
    () =>
      activeView !== "current-state"
        ? "skip"
        : currentStatePlatoonFilter === "all"
          ? {}
          : { platoon: currentStatePlatoonFilter },
    [activeView, currentStatePlatoonFilter],
  );
  const currentStateQuery = useQuery(
    api.paradeState.listCurrentState,
    currentStateArgs,
  ) as CurrentStateRow[] | undefined;
  const recordLogArgs = useMemo(() => {
    const args: {
      search?: string;
      statuses?: Status[];
      platoon?: string;
      fromDate: string;
      toDate?: string;
    } = {
      fromDate: recordFilterFromDate,
    };

    if (debouncedRecordSearch) {
      args.search = debouncedRecordSearch;
    }

    if (statusFilter.length > 0) {
      args.statuses = statusFilter;
    }

    if (platoonFilter !== "all") {
      args.platoon = platoonFilter;
    }

    if (recordFilterToDate) {
      args.toDate = recordFilterToDate;
    }

    return args;
  }, [
    debouncedRecordSearch,
    platoonFilter,
    recordFilterFromDate,
    recordFilterToDate,
    statusFilter,
  ]);
  const {
    results: recordLog,
    status: recordLogStatus,
    loadMore: loadMoreRecordLog,
  } = usePaginatedQuery(
    api.paradeState.listRecordLog,
    activeView === "record-log" ? recordLogArgs : "skip",
    { initialNumItems: 25 },
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPersonnel() {
      setIsPersonnelLoading(true);

      try {
        const response = await fetch(PERSONNEL_ROUTE_PATH, {
          cache: "no-store",
        });
        const json = (await response.json()) as PersonnelRecord[] | PersonnelRouteError;

        if (!response.ok) {
          throw new Error(
            "error" in json && json.error?.message
              ? json.error.message
              : "Unable to load personnel.",
          );
        }

        const parsed = z.array(personnelRecordSchema).safeParse(json);

        if (!parsed.success) {
          throw new Error("Personnel response shape was invalid.");
        }

        if (!cancelled) {
          setPersonnel(parsed.data);
          setPersonnelError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setPersonnelError(
            error instanceof Error
              ? error.message
              : "Unable to load personnel from Google Sheets.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsPersonnelLoading(false);
        }
      }
    }

    void loadPersonnel();

    return () => {
      cancelled = true;
    };
  }, [personnelRefreshKey]);

  async function handleRefreshPersonnel() {
    setPersonnelRefreshKey((value) => value + 1);
  }

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await authClient.signOut();
      router.replace("/sign-in");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  const currentState = currentStateQuery ?? [];
  const records = recordLog ?? [];
  const todayDate = getTodaySingaporeDateString();
  const rowForSelectedPersonnel = selectedRow
    ? currentState.find((row) => row.personnelKey === selectedRow.personnelKey) ?? selectedRow
    : null;
  const selectedRecord =
    recordDialogState?.mode === "edit" ? recordDialogState.record : null;
  const platoonOptions = [...APP_USER_PLATOON_VALUES];
  const hasStatusFilter = statusFilter.length > 0;
  const statusFilterLabel =
    statusFilter.length === 0
      ? "All statuses"
      : statusFilter.length === 1
        ? formatStatusLabel(statusFilter[0])
        : `${statusFilter.length} statuses`;
  function handleRecordDeleted(record: ParadeStateRecordDoc) {
    if (selectedRecord?._id === record._id) {
      setRecordDialogState(null);
    }

    if (recordForEndDateAdjust?._id === record._id) {
      setRecordForEndDateAdjust(null);
    }
  }

  async function handleEditDuplicateRecord(recordId: Id<"paradeStateRecords">) {
    const record = await convex.query(api.paradeState.getRecord, { recordId });

    if (!record) {
      toast.error("The duplicate record no longer exists.");
      return;
    }

    setRecordDialogState({ mode: "edit", record });
  }

  function toggleStatusFilter(status: Status) {
    setStatusFilter((current) =>
      current.includes(status)
        ? current.filter((value) => value !== status)
        : [...current, status],
    );
  }

  const filteredCurrentState = currentState.filter((row) => {
    const matchesPlatoon =
      currentStatePlatoonFilter === "all"
        ? true
        : row.platoon === currentStatePlatoonFilter;
    const matchesSearch = deferredCurrentStateSearch
      ? [
          row.rank,
          row.name,
          row.platoon,
          formatDesignation(row.designation),
          ...row.activeStatuses.map((status) =>
            formatStatusLabel(status.status, status.customStatus),
          ),
        ]
          .join(" ")
          .toLowerCase()
          .includes(deferredCurrentStateSearch)
      : true;

    return matchesPlatoon && matchesSearch;
  });

  const activeViewTitle =
    activeView === "current-state" ? "Current State" : "Record Log";
  const currentStatePlatoonFilterLabel =
    currentStatePlatoonFilter === "all"
      ? "All platoons"
      : currentStatePlatoonFilter;
  const hasCurrentStateSearch = currentStateSearch.trim().length > 0;
  const hasActiveCurrentStateFilters =
    hasCurrentStateSearch || currentStatePlatoonFilter !== "all";
  const activeCurrentStateFilterCount = [
    hasCurrentStateSearch,
    currentStatePlatoonFilter !== "all",
  ].filter(Boolean).length;
  const hasRecordSearch = recordSearch.trim().length > 0;
  const hasCustomDateRange =
    recordFilterFromDate !== todayDate || recordFilterToDate !== "";
  const hasActiveRecordFilters =
    hasRecordSearch ||
    hasStatusFilter ||
    platoonFilter !== "all" ||
    hasCustomDateRange;
  const activeRecordFilterCount = [
    hasRecordSearch,
    hasStatusFilter,
    platoonFilter !== "all",
    hasCustomDateRange,
  ].filter(Boolean).length;
  const nominalRollCount =
    isPersonnelLoading && !personnel.length ? "--" : String(personnel.length);
  const viewerInitials = getViewerInitials(viewer.name);
  const isRecordLogLoading = recordLogStatus === "LoadingFirstPage";
  const isRecordLogLoadingMore = recordLogStatus === "LoadingMore";
  const canLoadMoreRecordLog = recordLogStatus === "CanLoadMore";

  function handleRecordFilterFromDateChange(nextValue: string) {
    setRecordFilterFromDate(nextValue);

    if (recordFilterToDate && recordFilterToDate < nextValue) {
      setRecordFilterToDate(nextValue);
    }
  }

  function clearRecordFilters() {
    setRecordSearch("");
    setStatusFilter([]);
    setPlatoonFilter("all");
    setRecordFilterFromDate(todayDate);
    setRecordFilterToDate("");
  }

  function clearCurrentStateFilters() {
    setCurrentStateSearch("");
    setCurrentStatePlatoonFilter("all");
  }

  return (
    <SidebarProvider
      defaultOpen
      className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(79,120,67,0.14),_transparent_42%),linear-gradient(180deg,_#f4f0e3_0%,_#ebe5d4_45%,_#e1e7d9_100%)]"
    >
      <Sidebar variant="inset" collapsible="icon" className="border-sidebar-border/70">
        <SidebarHeader className="gap-2 p-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:p-2">
          <div className="flex items-center gap-3 rounded-2xl border border-sidebar-border/80 bg-white/70 px-3 py-3 shadow-sm transition-all duration-200 group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0 group-data-[collapsible=icon]:shadow-none">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(145deg,_rgba(44,74,36,0.96),_rgba(118,141,68,0.9))] text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-sm">
              RV
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-900/55">
                Revamp
              </p>
              <p className="mt-1 text-sm font-medium text-zinc-900">
                Daily operations board
              </p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <AppSidebarNav
            groups={getPrimaryNavGroups({
              activeItem:
                activeView === "current-state" ? "current-state" : "record-log",
              roles: viewer.roles,
            })}
            onItemSelect={(item) => {
              if (item.id === "current-state" || item.id === "record-log") {
                setActiveView(
                  item.id === "current-state" ? "current-state" : "record-log",
                );
              }
            }}
          />
        </SidebarContent>

        <SidebarSeparator />

        <SidebarFooter className="gap-3 p-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:p-2">
          <SidebarMenu className="group-data-[collapsible=icon]:items-center">
            <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <DropdownMenu>
                <SidebarMenuButton
                  size="lg"
                  tooltip={viewer.name}
                  className="min-h-12 rounded-2xl bg-[linear-gradient(135deg,_rgba(49,80,42,0.96),_rgba(87,103,53,0.88))] text-white shadow-sm transition-all duration-200 hover:bg-[linear-gradient(135deg,_rgba(55,88,46,0.98),_rgba(95,112,59,0.9))] hover:text-white data-active:bg-[linear-gradient(135deg,_rgba(55,88,46,0.98),_rgba(95,112,59,0.9))] data-[state=open]:bg-white/10 group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:p-0!"
                  render={<DropdownMenuTrigger />}
                >
                  <div className="flex size-7 items-center justify-center rounded-lg bg-white/14 text-xs font-semibold text-white transition-transform duration-200 group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:bg-white/18">
                    {viewerInitials || "U"}
                  </div>
                  <div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{viewer.name}</span>
                      <span className="rounded-md bg-white/12 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-emerald-50/90">
                        {nominalRollCount}
                      </span>
                    </div>
                    <span className="truncate text-xs text-emerald-100/75">
                      {viewer.email}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-emerald-50/80 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
                <DropdownMenuContent side="top" align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="px-2 py-2">
                      <div className="flex items-center gap-3">
                        <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-900 text-xs font-semibold text-white">
                          {viewerInitials || "U"}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {viewer.name}
                          </p>
                          <p className="truncate text-xs font-normal text-muted-foreground">
                            {viewer.email}
                          </p>
                        </div>
                      </div>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem disabled>
                      <UserRound className="size-4" />
                      Nominal Roll
                      <span className="ml-auto text-xs text-muted-foreground">
                        {nominalRollCount}
                      </span>
                    </DropdownMenuItem>
                    {hasPermission(viewer.roles, "userManagement.manage") ? (
                      <DropdownMenuItem
                        onClick={() => {
                          router.push("/admin/users");
                        }}
                      >
                        <ShieldCheck className="size-4" />
                        User management
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem
                      onClick={() => {
                        void handleRefreshPersonnel();
                      }}
                      disabled={isPersonnelLoading}
                    >
                      {isPersonnelLoading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <RefreshCw className="size-4" />
                      )}
                      Refresh personnel
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        void handleSignOut();
                      }}
                      disabled={isSigningOut}
                    >
                      {isSigningOut ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <LogOut className="size-4" />
                      )}
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="bg-transparent">
        <div className="flex min-h-svh flex-col">
          <header className="sticky top-0 z-20 border-b border-emerald-950/10 bg-background/80 backdrop-blur">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
              <div className="flex items-start gap-3 sm:min-w-0 sm:flex-1 sm:items-center">
                <SidebarTrigger className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-900/55">
                    Revamp operations board
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h1 className="text-lg font-semibold tracking-tight text-zinc-950">
                      {activeViewTitle}
                    </h1>
                    <Badge
                      variant="outline"
                      className="border-emerald-950/10 bg-white/70 text-zinc-700"
                    >
                      {viewer.name}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="grid shrink-0 grid-cols-1 gap-2 sm:flex">
                <Button
                  variant="outline"
                  onClick={() => setIsParadeStateOpen(true)}
                  className="w-full sm:w-auto"
                >
                  <ScrollText className="size-4" />
                  View Parade State
                </Button>
                <Button
                  onClick={() => setRecordDialogState({ mode: "add" })}
                  className="w-full sm:w-auto"
                >
                  <Plus className="size-4" />
                  Add Personnel Status
                </Button>
              </div>
            </div>
          </header>

          <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6">
            {personnelError ? (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                Personnel refresh failed: {personnelError}
              </div>
            ) : null}

            {activeView === "current-state" ? (
              <Card className="border-emerald-950/10 bg-white/80 shadow-lg shadow-emerald-950/5">
                <CardHeader className="border-b border-emerald-950/10">
                  <CardTitle>Active Satuses</CardTitle>
                  <CardDescription>
                    Table of Servicemen with all his currently active statuses.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="rounded-2xl border border-emerald-950/10 bg-background/85 p-3 shadow-sm shadow-emerald-950/5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-emerald-950/10 bg-white/80 px-2.5 text-xs font-medium text-zinc-700">
                          <SlidersHorizontal className="size-3.5" />
                          Filters
                        </div>
                        {hasActiveCurrentStateFilters ? (
                          <Badge
                            variant="outline"
                            className="h-8 shrink-0 border-amber-300 bg-amber-50 px-2.5 text-amber-900"
                          >
                            {activeCurrentStateFilterCount} active
                          </Badge>
                        ) : null}
                      </div>

                      {hasActiveCurrentStateFilters ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={clearCurrentStateFilters}
                          className="h-8 shrink-0 px-2 text-xs text-zinc-600 hover:text-zinc-950"
                        >
                          <X className="size-3.5" />
                          Clear
                        </Button>
                      ) : null}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 xl:flex-nowrap">
                      <div className="relative min-w-[10rem] flex-1 xl:w-full">
                        <Label htmlFor="current-state-search" className="sr-only">
                          Search current state
                        </Label>
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="current-state-search"
                          placeholder="Search serviceman, platoon, designation, or status"
                          value={currentStateSearch}
                          onChange={(event) => setCurrentStateSearch(event.target.value)}
                          className="h-8 rounded-md border-emerald-950/10 bg-white pl-9"
                        />
                      </div>

                      <div className="min-w-[10rem] md:hidden">
                        <Label className="sr-only">Current state platoon</Label>
                        <Select
                          value={currentStatePlatoonFilter}
                          onValueChange={(value) =>
                            setCurrentStatePlatoonFilter(value ?? "all")
                          }
                        >
                          <SelectTrigger className="h-8 w-full rounded-md border-emerald-950/10 bg-white">
                            <span className="truncate">
                              {currentStatePlatoonFilterLabel}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All platoons</SelectItem>
                            {platoonOptions.map((platoon) => (
                              <SelectItem key={platoon} value={platoon}>
                                {platoon}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {currentStateQuery === undefined ? (
                    <div className="space-y-3">
                      <Skeleton className="h-12 w-full rounded-xl" />
                      <Skeleton className="h-12 w-full rounded-xl" />
                      <Skeleton className="h-12 w-full rounded-xl" />
                    </div>
                  ) : filteredCurrentState.length ? (
                    <div className="space-y-3">
                      {filteredCurrentState.map((row) => (
                        <CurrentStateMobileCard
                          key={`${row.personnelKey}-mobile`}
                          row={row}
                          onViewRecords={() => setSelectedRow(row)}
                        />
                      ))}

                      <div className="hidden overflow-x-auto md:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Serviceman</TableHead>
                              <TableHead>
                                <div className="flex">
                                  <Select
                                    value={currentStatePlatoonFilter}
                                    onValueChange={(value) =>
                                      setCurrentStatePlatoonFilter(value ?? "all")
                                    }
                                  >
                                    <SelectTrigger className="h-8 min-w-[10rem] rounded-md border-emerald-950/10 bg-white text-xs font-normal">
                                      <span className="truncate">
                                        {currentStatePlatoonFilterLabel}
                                      </span>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="all">All platoons</SelectItem>
                                      {platoonOptions.map((platoon) => (
                                        <SelectItem key={platoon} value={platoon}>
                                          {platoon}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </TableHead>
                              <TableHead>Designation</TableHead>
                              <TableHead>Active statuses</TableHead>
                              <TableHead>In/Out Camp</TableHead>
                              {/* <TableHead>Record count</TableHead> */}
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredCurrentState.map((row) => (
                              <TableRow key={row.personnelKey}>
                                <TableCell>
                                  <div className="min-w-44">
                                    <p className="font-medium text-zinc-950">
                                      {row.rank}{" "}
                                      <span title={row.name}>
                                        {truncateText(
                                          row.name,
                                          MAX_CURRENT_STATE_NAME_LENGTH,
                                        )}
                                      </span>
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {row.activeRecordCount} active record
                                      {row.activeRecordCount === 1 ? "" : "s"}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>{row.platoon}</TableCell>
                                <TableCell>{formatDesignation(row.designation)}</TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-2">
                                    {row.activeStatuses.map((status) => (
                                      <StatusBadge
                                        key={`${row.personnelKey}-${status.status}-${status.customStatus ?? ""}`}
                                        status={status.status}
                                        customStatus={status.customStatus}
                                      />
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={row.hasParadeStateImpact ? "outline" : "default"}
                                    className={
                                      row.hasParadeStateImpact
                                        ? ""
                                        : "bg-emerald-800 text-white"
                                    }
                                  >
                                    {row.hasParadeStateImpact
                                      ? "Out of Camp"
                                      : "In Camp"}
                                  </Badge>
                                </TableCell>
                                {/* <TableCell>{row.activeRecordCount}</TableCell> */}
                                <TableCell className="text-right">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedRow(row)}
                                  >
                                    View records
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                      {currentState.length
                        ? "No current-state rows match the active filters."
                        : "No active parade-state records today."}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-emerald-950/10 bg-white/80 shadow-lg shadow-emerald-950/5">
                <CardHeader className="border-b border-emerald-950/10">
                  <CardTitle>Record Log</CardTitle>
                  <CardDescription>
                    Full historical log of all statuses.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="rounded-2xl border border-emerald-950/10 bg-background/85 p-3 shadow-sm shadow-emerald-950/5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-emerald-950/10 bg-white/80 px-2.5 text-xs font-medium text-zinc-700">
                          <SlidersHorizontal className="size-3.5" />
                          Filters
                        </div>
                        {hasActiveRecordFilters ? (
                          <Badge
                            variant="outline"
                            className="h-8 shrink-0 border-amber-300 bg-amber-50 px-2.5 text-amber-900"
                          >
                            {activeRecordFilterCount} active
                          </Badge>
                        ) : null}
                      </div>

                      {hasActiveRecordFilters ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={clearRecordFilters}
                          className="h-8 shrink-0 px-2 text-xs text-zinc-600 hover:text-zinc-950"
                        >
                          <X className="size-3.5" />
                          Clear
                        </Button>
                      ) : null}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 xl:flex-nowrap">
                      <div className="relative min-w-[10rem] flex-1 xl:w-full">
                        <Label htmlFor="record-search" className="sr-only">
                          Search records
                        </Label>
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="record-search"
                          placeholder="Search"
                          value={recordSearch}
                          onChange={(event) => setRecordSearch(event.target.value)}
                          className="h-8 rounded-md border-emerald-950/10 bg-white pl-9"
                        />
                      </div>

                      <div className="min-w-[10rem]">
                          <Label className="sr-only">Status</Label>
                          <Popover
                            open={isStatusFilterOpen}
                            onOpenChange={setIsStatusFilterOpen}
                          >
                            <PopoverTrigger
                              className={`${buttonVariants({ variant: "outline" })} h-8 w-full justify-between rounded-md border-emerald-950/10 bg-white px-3 text-left text-sm font-normal shadow-none hover:bg-white`}
                            >
                              <span
                                className={`truncate ${hasStatusFilter ? "text-zinc-900" : "text-muted-foreground"}`}
                              >
                                {statusFilterLabel}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {hasStatusFilter ? (
                                  <Badge
                                    variant="secondary"
                                    className="h-5 rounded-md px-1.5 text-xs font-medium"
                                  >
                                    {statusFilter.length}
                                  </Badge>
                                ) : null}
                                <ChevronsUpDown className="size-4 opacity-50" />
                              </div>
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              className="w-[min(18rem,calc(100vw-2rem))] p-0"
                            >
                              <Command>
                                <CommandInput placeholder="Search statuses..." />
                                <CommandList>
                                  <CommandEmpty>No matching statuses found.</CommandEmpty>
                                  {STATUS_VALUES.map((status) => {
                                    const isSelected = statusFilter.includes(status);

                                    return (
                                      <CommandItem
                                        key={status}
                                        value={formatStatusLabel(status)}
                                        data-checked={isSelected}
                                        onSelect={() => toggleStatusFilter(status)}
                                      >
                                        {formatStatusLabel(status)}
                                      </CommandItem>
                                    );
                                  })}
                                  {hasStatusFilter ? (
                                    <CommandItem onSelect={() => setStatusFilter([])}>
                                      Clear status filter
                                    </CommandItem>
                                  ) : null}
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                      </div>

                      <div className="min-w-[8rem]">
                          <Label className="sr-only">Platoon</Label>
                          <Select
                            value={platoonFilter}
                            onValueChange={(value) => setPlatoonFilter(value ?? "all")}
                          >
                            <SelectTrigger className="h-8 w-full rounded-md border-emerald-950/10 bg-white">
                              <SelectValue placeholder="Platoon" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All platoons</SelectItem>
                              {platoonOptions.map((platoon) => (
                                <SelectItem key={platoon} value={platoon}>
                                  {platoon}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                      </div>

                      <div className="flex items-center gap-2 rounded-md border border-emerald-950/10 bg-white px-2 py-1">
                        <CompactCalendarFilterField
                          id="record-filter-from"
                          label="From"
                          value={recordFilterFromDate}
                          onChange={handleRecordFilterFromDateChange}
                          placeholder="Select"
                          maxDate={recordFilterToDate || undefined}
                        />
                        <CompactCalendarFilterField
                          id="record-filter-to"
                          label="To"
                          value={recordFilterToDate}
                          onChange={setRecordFilterToDate}
                          placeholder="Today"
                          minDate={recordFilterFromDate}
                        />
                        {recordFilterToDate ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setRecordFilterToDate("")}
                            className="h-6 px-1.5 text-[11px] text-zinc-500 hover:bg-transparent hover:text-zinc-900"
                          >
                            Today
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {isRecordLogLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-12 w-full rounded-xl" />
                      <Skeleton className="h-12 w-full rounded-xl" />
                      <Skeleton className="h-12 w-full rounded-xl" />
                    </div>
                  ) : records.length ? (
                    <div className="space-y-3">
                      {records.map((record) => (
                        <RecordLogMobileCard
                          key={`${record._id}-mobile`}
                          record={record}
                          onEdit={() =>
                            setRecordDialogState({ mode: "edit", record })
                          }
                          onDelete={() => setRecordPendingDelete(record)}
                          onAdjustEndDate={() => setRecordForEndDateAdjust(record)}
                        />
                      ))}

                      <div className="hidden overflow-x-auto md:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Serviceman</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Submitted by</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {records.map((record) => (
                              <TableRow key={record._id}>
                                <TableCell>
                                  <div className="min-w-52">
                                    <p className="text-xs font-medium text-zinc-950">
                                      {record.rank} {record.name}
                                    </p>
                                    <p className="text-[12px] text-muted-foreground">
                                      {record.platoon} / {formatDesignation(record.designation)}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-2">
                                    <StatusBadge
                                      status={record.status}
                                      customStatus={record.customStatus}
                                    />
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="relative min-w-44 pr-3">
                                    <span className="absolute right-0 top-0.5">
                                      <TemporalBucketDot bucket={getRecordTemporalBucket(record)} />
                                    </span>
                                    <p>{formatRecordPeriod(record)}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatRemarks(record.remarks)}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="min-w-44">
                                    <p className="text-xs font-medium text-zinc-950">
                                      {record.submittedByName}
                                    </p>
                                    <p className="text-[12px] text-muted-foreground">
                                      {formatTimestampLabel(record.createdAt)}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <RecordActionsMenu
                                    record={record}
                                    onEdit={() =>
                                      setRecordDialogState({ mode: "edit", record })
                                    }
                                    onDelete={() => setRecordPendingDelete(record)}
                                    onAdjustEndDate={() =>
                                      setRecordForEndDateAdjust(record)
                                    }
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {canLoadMoreRecordLog ? (
                        <div className="flex justify-center pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => loadMoreRecordLog(25)}
                            disabled={isRecordLogLoadingMore}
                          >
                            {isRecordLogLoadingMore ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : null}
                            Load more
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                      No records match the current filters.
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </SidebarInset>

      <RecordDialog
        open={recordDialogState !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRecordDialogState(null);
          }
        }}
        mode={recordDialogState?.mode ?? "add"}
        record={selectedRecord}
        personnel={personnel}
        personnelError={personnelError}
        personnelLoading={isPersonnelLoading}
        submittedBy={viewer.name}
        onEditDuplicateRecord={handleEditDuplicateRecord}
      />
      <ParadeReportModal
        open={isParadeStateOpen}
        onOpenChange={setIsParadeStateOpen}
      />
      <AdjustEndDateDialog
        open={!!recordForEndDateAdjust}
        onOpenChange={(open) => {
          if (!open) {
            setRecordForEndDateAdjust(null);
          }
        }}
        record={recordForEndDateAdjust}
      />
      <PersonnelRecordsSheet
        open={!!selectedRow}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRow(null);
          }
        }}
        selectedRow={rowForSelectedPersonnel}
        onEditRecord={(record) => setRecordDialogState({ mode: "edit", record })}
        onDeleteRecord={setRecordPendingDelete}
        onAdjustEndDate={setRecordForEndDateAdjust}
      />
      <DeleteRecordDialog
        open={!!recordPendingDelete}
        onOpenChange={(open) => {
          if (!open) {
            setRecordPendingDelete(null);
          }
        }}
        record={recordPendingDelete}
        onDeleted={handleRecordDeleted}
      />
    </SidebarProvider>
  );
}
