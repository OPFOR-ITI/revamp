"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  ChevronsUpDown,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "../../../convex/_generated/api";
import { StatusBadge } from "@/components/parade-state/status-badge";
import { ParadeReportModal } from "@/components/parade-state/parade-report-modal";
import {
  type CurrentStateRow,
  type ParadeStateRecordDoc,
} from "@/components/parade-state/types";
import { PersonnelCombobox } from "@/components/parade-state/personnel-combobox";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { DateStepperField } from "@/components/ui/date-stepper-field";
import {
  MAX_CUSTOM_STATUS_LENGTH,
  MAX_REMARKS_LENGTH,
  OTHER_STATUS_VALUE,
  PERSONNEL_ROUTE_PATH,
  STATUS_VALUES,
  formatStatusLabel,
  isOtherStatus,
  isPermanentRecord,
  type Status,
  type UserRole,
} from "@/lib/constants";
import {
  addDaysToDateString,
  getDayOffsetBetweenDates,
  formatDateLabel,
  formatTimestampLabel,
  getTemporalBucketForDayRange,
  getTodaySingaporeDateString,
  getTodaySingaporeDayIndex,
} from "@/lib/date";
import { authClient } from "@/lib/auth-client";
import {
  formatDesignation,
  personnelRecordSchema,
  type PersonnelRecord,
} from "@/lib/personnel";
import { getPrimaryNavGroups } from "@/components/layout/app-navigation";
import { AppSidebarNav } from "@/components/layout/app-sidebar-nav";

const addRecordSchema = z
  .object({
    personnelKey: z.string().min(1, "Select a serviceman."),
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
    remarks: z
      .string()
      .max(MAX_REMARKS_LENGTH, `Remarks must be ${MAX_REMARKS_LENGTH} characters or fewer.`)
      .optional(),
  })
  .superRefine((values, ctx) => {
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

    if (values.status === OTHER_STATUS_VALUE && !values.customStatus?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customStatus"],
        message: "Enter the custom status for Others.",
      });
    }
  });

const editRecordSchema = z
  .object({
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
    remarks: z
      .string()
      .max(MAX_REMARKS_LENGTH, `Remarks must be ${MAX_REMARKS_LENGTH} characters or fewer.`)
      .optional(),
  })
  .superRefine((values, ctx) => {
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

    if (values.status === OTHER_STATUS_VALUE && !values.customStatus?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customStatus"],
        message: "Enter the custom status for Others.",
      });
    }
  });

const adjustEndDateSchema = z.object({
  endDate: z.string().min(1, "End date is required."),
});

type AddRecordValues = z.infer<typeof addRecordSchema>;
type EditRecordValues = z.infer<typeof editRecordSchema>;
type AdjustEndDateValues = z.infer<typeof adjustEndDateSchema>;
type RecordTemporalFilter = "all" | "active" | "past" | "future";
type ImpactFilter = "all" | "impact" | "no-impact";
type DashboardView = "current-state" | "record-log";
type PersonnelRouteError = { error?: { code?: string; message?: string } };

function getEmptyAddRecordValues(): AddRecordValues {
  return {
    personnelKey: "",
    status: STATUS_VALUES[0],
    customStatus: "",
    affectParadeState: false,
    isPermanent: false,
    startDate: getTodaySingaporeDateString(),
    endDate: "",
    remarks: "",
  };
}

function getRecordTemporalBucket(record: ParadeStateRecordDoc) {
  return getTemporalBucketForDayRange(
    record.startDay,
    record.endDay,
    getTodaySingaporeDayIndex(),
  );
}

function formatRemarks(value?: string) {
  return value?.trim() ? value.trim() : "No remarks";
}

function formatRecordPeriod(record: {
  startDate: string;
  endDate?: string;
  isPermanent?: boolean;
}) {
  if (isPermanentRecord(record)) {
    return "Permanent";
  }

  return `${formatDateLabel(record.startDate)} to ${formatDateLabel(record.endDate ?? record.startDate)}`;
}

function ImpactBadge({ affectsParadeState }: { affectsParadeState: boolean }) {
  return (
    <Badge
      variant={affectsParadeState ? "default" : "outline"}
      className={affectsParadeState ? "bg-emerald-800 text-white" : ""}
    >
      {affectsParadeState ? "Out-of-Camp" : "In-Camp"}
    </Badge>
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
      <div className="flex h-full items-center justify-between rounded-2xl border border-border px-4 py-3">
        <div>
          <FormLabel>Permanent status</FormLabel>
          <FormDescription>
           
          </FormDescription>
        </div>
        <div className="flex items-center gap-3">
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

function PersonnelPreview({
  personnel,
  submittedBy,
}: {
  personnel?: PersonnelRecord;
  submittedBy?: string;
}) {
  return (
    <div className="grid gap-3 rounded-2xl border border-emerald-950/10 bg-emerald-950/[0.03] p-4 sm:grid-cols-2">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-emerald-900/55">
          Rank
        </p>
        <p className="mt-1 font-medium text-zinc-900">
          {personnel?.rank ?? "--"}
        </p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-emerald-900/55">
          Name
        </p>
        <p className="mt-1 font-medium text-zinc-900">
          {personnel?.name ?? "--"}
        </p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-emerald-900/55">
          Platoon
        </p>
        <p className="mt-1 font-medium text-zinc-900">
          {personnel?.platoon ?? "--"}
        </p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-emerald-900/55">
          Designation
        </p>
        <p className="mt-1 font-medium text-zinc-900">
          {personnel ? formatDesignation(personnel.designation) : "--"}
        </p>
      </div>
      {submittedBy ? (
        <div className="sm:col-span-2">
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-900/55">
            Submitted by
          </p>
          <p className="mt-1 font-medium text-zinc-900">{submittedBy}</p>
        </div>
      ) : null}
    </div>
  );
}

function RecordCard({ record }: { record: ParadeStateRecordDoc }) {
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
        <div className="text-right text-xs text-muted-foreground">
          <p>Submitted by {record.submittedByName}</p>
          <p>{formatTimestampLabel(record.createdAt)}</p>
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
    <div className="grid gap-5 sm:grid-cols-2">
      <FormItem>
        <FormLabel htmlFor="custom-status">Custom status</FormLabel>
        <FormControl>
          <Input
            id="custom-status"
            value={customStatus}
            maxLength={MAX_CUSTOM_STATUS_LENGTH}
            placeholder="Type the status to show after Others"
            onChange={(event) => onCustomStatusChange(event.target.value)}
          />
        </FormControl>
        <FormDescription>
          Displays as {OTHER_STATUS_VALUE}(typed status).
        </FormDescription>
        <FormMessage>{customStatusError}</FormMessage>
      </FormItem>

      <FormItem>
        <div className="flex h-full items-center justify-between rounded-2xl border border-border px-4 py-3">
          <div>
            <FormLabel>Parade-state impact</FormLabel>
            <FormDescription>
              {/* Choose whether this custom status affects parade state. */}
            </FormDescription>
          </div>
          <div className="flex items-center gap-3">
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

function AddRecordDialog({
  open,
  onOpenChange,
  personnel,
  personnelError,
  personnelLoading,
  submittedBy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personnel: PersonnelRecord[];
  personnelError: string | null;
  personnelLoading: boolean;
  submittedBy: string;
}) {
  const createRecord = useMutation(api.paradeState.createRecord);
  const form = useForm<AddRecordValues>({
    resolver: zodResolver(addRecordSchema),
    defaultValues: getEmptyAddRecordValues(),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const selectedPersonnel = personnel.find(
    (person) => person.personnelKey === selectedPersonnelKey,
  );
  const pickerDisabled =
    personnelLoading || !!personnelError || personnel.length === 0;

  useEffect(() => {
    if (!open) {
      form.reset(getEmptyAddRecordValues());
    }
  }, [form, open]);

  useEffect(() => {
    if (isOtherStatus(selectedStatus)) {
      return;
    }

    form.setValue("customStatus", "", {
      shouldDirty: false,
      shouldValidate: false,
    });
    form.setValue("affectParadeState", false, {
      shouldDirty: false,
      shouldValidate: false,
    });
  }, [form, selectedStatus]);

  const dayOffsetInput = isPermanent
    ? ""
    : getDaysOffsetInputValue(startDate, endDate);

  function handleStartDateChange(nextValue: string) {
    form.setValue("startDate", nextValue, {
      shouldDirty: true,
      shouldValidate: true,
    });

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

  async function onSubmit(values: AddRecordValues) {
    if (!selectedPersonnel) {
      form.setError("personnelKey", {
        message: "Select a serviceman before saving.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
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
        affectParadeState: isOtherStatus(values.status)
          ? values.affectParadeState
          : undefined,
        isPermanent: values.isPermanent,
        startDate: values.startDate,
        endDate: values.isPermanent ? undefined : values.endDate?.trim() || undefined,
        remarks: values.remarks?.trim() ? values.remarks.trim() : undefined,
      });

      toast.success("Parade-state record created.");
      onOpenChange(false);
      form.reset(getEmptyAddRecordValues());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save record.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-1rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add Personnel Status</DialogTitle>
          <DialogDescription>
            Create a new perssonel status record
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
            {personnelError ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                {personnelError} Existing records still work, but the personnel
                picker is disabled until refresh succeeds.
              </div>
            ) : null}

            <FormItem>
              <FormLabel>Serviceman</FormLabel>
              <PersonnelCombobox
                personnel={personnel}
                value={selectedPersonnelKey}
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

            <PersonnelPreview personnel={selectedPersonnel} submittedBy={submittedBy} />

            <div className="grid gap-5 sm:grid-cols-2">
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

              <PermanentStatusField
                checked={!!isPermanent}
                onCheckedChange={(value) =>
                  form.setValue("isPermanent", value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
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
            ) : null}

            <div className="grid gap-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)] sm:items-start">
              {isPermanent ? (
                <div className="flex items-center rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground sm:col-span-3">
                  No start or end date. Permanent statuses become active
                  immediately and stay active until you edit the record later.
                </div>
              ) : (
                <>
                  <DateStepperField
                    id="add-start-date"
                    label="Start date"
                    value={startDate}
                    onChange={handleStartDateChange}
                    error={form.formState.errors.startDate?.message}
                  />

                  <StatusDaysField
                    id="add-duration-days"
                    value={dayOffsetInput}
                    onChange={handleDayOffsetChange}
                  />

                  <DateStepperField
                    id="add-end-date"
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
              <FormLabel htmlFor="add-remarks">Remarks</FormLabel>
              <FormControl>
                <Textarea
                  id="add-remarks"
                  rows={4}
                  placeholder="Optional supporting details"
                  {...form.register("remarks")}
                />
              </FormControl>
              <FormDescription>
                Optional. Up to {MAX_REMARKS_LENGTH} characters.
              </FormDescription>
              <FormMessage>{form.formState.errors.remarks?.message}</FormMessage>
            </FormItem>

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
                disabled={pickerDisabled || isSubmitting}
                className="w-full sm:w-auto"
              >
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                Save record
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditRecordDialog({
  open,
  onOpenChange,
  record,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: ParadeStateRecordDoc | null;
}) {
  const updateRecord = useMutation(api.paradeState.updateRecord);
  const form = useForm<EditRecordValues>({
    resolver: zodResolver(editRecordSchema),
    defaultValues: {
      status: STATUS_VALUES[0],
      customStatus: "",
      affectParadeState: false,
      isPermanent: false,
      startDate: getTodaySingaporeDateString(),
      endDate: "",
      remarks: "",
    },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  useEffect(() => {
    if (!record) {
      return;
    }

    form.reset({
      status: record.status,
      customStatus: record.customStatus ?? "",
      affectParadeState: record.affectParadeState,
      isPermanent: isPermanentRecord(record),
      startDate: record.startDate,
      endDate: record.endDate ?? "",
      remarks: record.remarks ?? "",
    });
  }, [form, record]);

  useEffect(() => {
    if (isOtherStatus(selectedStatus)) {
      return;
    }

    form.setValue("customStatus", "", {
      shouldDirty: false,
      shouldValidate: false,
    });
    form.setValue("affectParadeState", false, {
      shouldDirty: false,
      shouldValidate: false,
    });
  }, [form, selectedStatus]);

  const dayOffsetInput = isPermanent
    ? ""
    : getDaysOffsetInputValue(startDate, endDate);

  function handleStartDateChange(nextValue: string) {
    form.setValue("startDate", nextValue, {
      shouldDirty: true,
      shouldValidate: true,
    });

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

  async function onSubmit(values: EditRecordValues) {
    if (!record) {
      return;
    }

    setIsSubmitting(true);

    try {
      await updateRecord({
        recordId: record._id,
        status: values.status,
        customStatus: isOtherStatus(values.status)
          ? values.customStatus?.trim() || undefined
          : undefined,
        affectParadeState: isOtherStatus(values.status)
          ? values.affectParadeState
          : undefined,
        isPermanent: values.isPermanent,
        startDate: values.startDate,
        endDate: values.isPermanent ? undefined : values.endDate?.trim() || undefined,
        remarks: values.remarks?.trim() ? values.remarks.trim() : undefined,
      });

      toast.success("Record updated.");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update record.");
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
          <DialogTitle>Edit Record</DialogTitle>
          <DialogDescription>
            Update status, dates, or remarks. Serviceman identity stays locked
            to preserve the historical snapshot.
          </DialogDescription>
        </DialogHeader>

        {record ? (
          <Form {...form}>
            <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
              <PersonnelPreview personnel={previewPersonnel} />

              <div className="grid gap-5 sm:grid-cols-2">
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

                <PermanentStatusField
                  checked={!!isPermanent}
                  onCheckedChange={(value) =>
                    form.setValue("isPermanent", value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
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
              ) : null}

              <div className="grid gap-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)] sm:items-start">
                {isPermanent ? (
                  <div className="flex items-center rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground sm:col-span-3">
                    No start or end date. Turn off permanent status if you need
                    this record to use a dated range.
                  </div>
                ) : (
                  <>
                    <DateStepperField
                      id="edit-start-date"
                      label="Start date"
                      value={startDate}
                      onChange={handleStartDateChange}
                      error={form.formState.errors.startDate?.message}
                    />

                    <StatusDaysField
                      id="edit-duration-days"
                      value={dayOffsetInput}
                      onChange={handleDayOffsetChange}
                    />

                    <DateStepperField
                      id="edit-end-date"
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
                <FormLabel htmlFor="edit-remarks">Remarks</FormLabel>
                <FormControl>
                  <Textarea
                    id="edit-remarks"
                    rows={4}
                    {...form.register("remarks")}
                  />
                </FormControl>
                <FormMessage>{form.formState.errors.remarks?.message}</FormMessage>
              </FormItem>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  Save changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : null}
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRow: CurrentStateRow | null;
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
            records.map((record) => <RecordCard key={record._id} record={record} />)
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
  onAdjustEndDate,
}: {
  record: ParadeStateRecordDoc;
  onEdit: () => void;
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
        Manage
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
        {!isPermanentRecord(record) ? (
          <DropdownMenuItem onClick={onAdjustEndDate}>
            Adjust end date
          </DropdownMenuItem>
        ) : null}
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
          variant={row.hasParadeStateImpact ? "default" : "outline"}
          className={row.hasParadeStateImpact ? "bg-emerald-800 text-white" : ""}
        >
          {row.hasParadeStateImpact ? "Impact" : "No impact"}
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
  onAdjustEndDate,
}: {
  record: ParadeStateRecordDoc;
  onEdit: () => void;
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
          onAdjustEndDate={onAdjustEndDate}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <StatusBadge
          status={record.status}
          customStatus={record.customStatus}
        />
        {isPermanentRecord(record) ? <Badge variant="outline">Permanent</Badge> : null}
        <Badge variant="outline">{getRecordTemporalBucket(record)}</Badge>
        <Badge
          variant={record.affectParadeState ? "default" : "outline"}
          className={record.affectParadeState ? "bg-emerald-800 text-white" : ""}
        >
          {record.affectParadeState ? "Impact" : "No impact"}
        </Badge>
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <div>
          <p className="font-medium text-zinc-950">{formatRecordPeriod(record)}</p>
          <p className="text-muted-foreground">{formatRemarks(record.remarks)}</p>
        </div>
        <div className="text-muted-foreground">
          <p>Submitted by {record.submittedByName}</p>
          <p>{formatTimestampLabel(record.createdAt)}</p>
        </div>
      </div>
    </div>
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
    role: UserRole;
  };
}) {
  const router = useRouter();
  const currentStateQuery =
    useQuery(api.paradeState.listCurrentState, {}) as CurrentStateRow[] | undefined;
  const recordLog = useQuery(api.paradeState.listRecordLog, {});

  const [personnel, setPersonnel] = useState<PersonnelRecord[]>([]);
  const [personnelError, setPersonnelError] = useState<string | null>(null);
  const [personnelRefreshKey, setPersonnelRefreshKey] = useState(0);
  const [isPersonnelLoading, setIsPersonnelLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isParadeReportOpen, setIsParadeReportOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<CurrentStateRow | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<ParadeStateRecordDoc | null>(
    null,
  );
  const [recordForEndDateAdjust, setRecordForEndDateAdjust] =
    useState<ParadeStateRecordDoc | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [platoonFilter, setPlatoonFilter] = useState("all");
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>("all");
  const [temporalFilter, setTemporalFilter] =
    useState<RecordTemporalFilter>("all");
  const [activeView, setActiveView] = useState<DashboardView>(initialView);
  const [isSigningOut, setIsSigningOut] = useState(false);

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
  const platoonOptions = Array.from(new Set(records.map((record) => record.platoon))).sort(
    (left, right) => left.localeCompare(right),
  );

  const filteredRecords = records.filter((record) => {
    const matchesStatus =
      statusFilter === "all" ? true : record.status === statusFilter;
    const matchesPlatoon =
      platoonFilter === "all" ? true : record.platoon === platoonFilter;
    const matchesImpact =
      impactFilter === "all"
        ? true
        : impactFilter === "impact"
          ? record.affectParadeState
          : !record.affectParadeState;
    const temporalBucket = getRecordTemporalBucket(record);
    const matchesTemporal =
      temporalFilter === "all" ? true : temporalBucket === temporalFilter;
    const matchesSearch = deferredSearch
      ? `${record.rank} ${record.name} ${record.platoon} ${formatDesignation(record.designation)} ${formatStatusLabel(record.status, record.customStatus)}`
          .toLowerCase()
          .includes(deferredSearch)
      : true;

    return (
      matchesStatus &&
      matchesPlatoon &&
      matchesImpact &&
      matchesTemporal &&
      matchesSearch
    );
  });

  const activeViewTitle =
    activeView === "current-state" ? "Current State" : "Record Log";
  const activeViewDescription =
    activeView === "current-state"
      ? "One row per serviceman with overlapping active statuses grouped together."
      : "Historical parade-state records with compact client-side filters.";
  const nominalRollCount =
    isPersonnelLoading && !personnel.length ? "--" : String(personnel.length);
  const viewerInitials = getViewerInitials(viewer.name);

  return (
    <SidebarProvider
      defaultOpen
      className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(79,120,67,0.14),_transparent_42%),linear-gradient(180deg,_#f4f0e3_0%,_#ebe5d4_45%,_#e1e7d9_100%)]"
    >
      <Sidebar variant="inset" collapsible="icon" className="border-sidebar-border/70">
        <SidebarHeader className="gap-2 p-3">
          <div className="rounded-2xl border border-sidebar-border/80 bg-white/70 px-3 py-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-900/55">
              Revamp
            </p>
            <p className="mt-1 text-sm font-medium text-zinc-900">
              Daily operations board
            </p>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <AppSidebarNav
            groups={getPrimaryNavGroups({
              activeItem:
                activeView === "current-state" ? "current-state" : "record-log",
              role: viewer.role,
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

        <SidebarFooter className="gap-3 p-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <SidebarMenuButton
                  size="lg"
                  className="bg-[linear-gradient(135deg,_rgba(49,80,42,0.96),_rgba(87,103,53,0.88))] text-white hover:bg-[linear-gradient(135deg,_rgba(55,88,46,0.98),_rgba(95,112,59,0.9))] hover:text-white data-active:bg-[linear-gradient(135deg,_rgba(55,88,46,0.98),_rgba(95,112,59,0.9))] data-[state=open]:bg-white/10"
                  render={<DropdownMenuTrigger />}
                >
                  <div className="flex size-8 items-center justify-center rounded-lg bg-white/14 text-xs font-semibold text-white">
                    {viewerInitials || "U"}
                  </div>
                  <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
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
                  <ChevronsUpDown className="ml-auto size-4 text-emerald-50/80" />
                </SidebarMenuButton>
                <DropdownMenuContent side="top" align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="px-2 py-2">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-900 text-xs font-semibold text-white">
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
                    {viewer.role === "admin" ? (
                      <DropdownMenuItem
                        onClick={() => {
                          router.push("/admin/users");
                        }}
                      >
                        <ShieldCheck className="size-4" />
                        User approvals
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
                  onClick={() => setIsParadeReportOpen(true)}
                  className="w-full sm:w-auto"
                >
                  <ScrollText className="size-4" />
                  View Parade Report
                </Button>
                <Button onClick={() => setIsAddDialogOpen(true)} className="w-full sm:w-auto">
                  <Plus className="size-4" />
                  Add Parade State
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

            <Card
              size="sm"
              className="border-emerald-950/10 bg-white/75 shadow-sm shadow-emerald-950/5"
            >
              <CardContent className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-950">{activeViewTitle}</p>
                  <p className="text-sm text-zinc-600">{activeViewDescription}</p>
                </div>
              </CardContent>
            </Card>

            {activeView === "current-state" ? (
              <Card className="border-emerald-950/10 bg-white/80 shadow-lg shadow-emerald-950/5">
                <CardHeader className="border-b border-emerald-950/10">
                  <CardTitle>Distinct Current State</CardTitle>
                  <CardDescription>
                    One row per serviceman with all currently active overlapping
                    statuses grouped together.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  {currentStateQuery === undefined ? (
                    <div className="space-y-3">
                      <Skeleton className="h-12 w-full rounded-xl" />
                      <Skeleton className="h-12 w-full rounded-xl" />
                      <Skeleton className="h-12 w-full rounded-xl" />
                    </div>
                  ) : currentState.length ? (
                    <div className="space-y-3">
                      {currentState.map((row) => (
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
                              <TableHead>Platoon</TableHead>
                              <TableHead>Designation</TableHead>
                              <TableHead>Active statuses</TableHead>
                              <TableHead>Impact</TableHead>
                              <TableHead>Record count</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {currentState.map((row) => (
                              <TableRow key={row.personnelKey}>
                                <TableCell>
                                  <div className="min-w-44">
                                    <p className="font-medium text-zinc-950">
                                      {row.rank} {row.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {row.records.length} active record
                                      {row.records.length === 1 ? "" : "s"}
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
                                    variant={row.hasParadeStateImpact ? "default" : "outline"}
                                    className={
                                      row.hasParadeStateImpact
                                        ? "bg-emerald-800 text-white"
                                        : ""
                                    }
                                  >
                                    {row.hasParadeStateImpact
                                      ? "Impacts parade state"
                                      : "No impact"}
                                  </Badge>
                                </TableCell>
                                <TableCell>{row.activeRecordCount}</TableCell>
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
                      No active parade-state records today.
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-emerald-950/10 bg-white/80 shadow-lg shadow-emerald-950/5">
                <CardHeader className="border-b border-emerald-950/10">
                  <CardTitle>Record Log</CardTitle>
                  <CardDescription>
                    Full historical log with compact filters for status, platoon,
                    impact, and time bucket.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="grid gap-3 rounded-2xl border border-border bg-background/80 p-3 lg:grid-cols-[2fr,1fr,1fr,1fr,1fr]">
                    <div className="grid gap-2">
                      <Label htmlFor="record-search">Search by name</Label>
                      <Input
                        id="record-search"
                        placeholder="Search rank or serviceman name"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label>Status</Label>
                      <Select
                        value={statusFilter}
                        onValueChange={(value) =>
                          setStatusFilter((value ?? "all") as Status | "all")
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          {STATUS_VALUES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label>Platoon</Label>
                      <Select
                        value={platoonFilter}
                        onValueChange={(value) => setPlatoonFilter(value ?? "all")}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="All platoons" />
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

                    <div className="grid gap-2">
                      <Label>Impact</Label>
                      <Select
                        value={impactFilter}
                        onValueChange={(value) =>
                          setImpactFilter((value ?? "all") as ImpactFilter)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All records</SelectItem>
                          <SelectItem value="impact">Impact only</SelectItem>
                          <SelectItem value="no-impact">No impact only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label>Time bucket</Label>
                      <Select
                        value={temporalFilter}
                        onValueChange={(value) =>
                          setTemporalFilter((value ?? "all") as RecordTemporalFilter)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All records</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="future">Future</SelectItem>
                          <SelectItem value="past">Past</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {recordLog === undefined ? (
                    <div className="space-y-3">
                      <Skeleton className="h-12 w-full rounded-xl" />
                      <Skeleton className="h-12 w-full rounded-xl" />
                      <Skeleton className="h-12 w-full rounded-xl" />
                    </div>
                  ) : filteredRecords.length ? (
                    <div className="space-y-3">
                      {filteredRecords.map((record) => (
                        <RecordLogMobileCard
                          key={`${record._id}-mobile`}
                          record={record}
                          onEdit={() => setSelectedRecord(record)}
                          onAdjustEndDate={() => setRecordForEndDateAdjust(record)}
                        />
                      ))}

                      <div className="hidden overflow-x-auto md:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Serviceman</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Period</TableHead>
                              <TableHead>Impact</TableHead>
                              <TableHead>Submitted by</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredRecords.map((record) => (
                              <TableRow key={record._id}>
                                <TableCell>
                                  <div className="min-w-52">
                                    <p className="font-medium text-zinc-950">
                                      {record.rank} {record.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
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
                                    {isPermanentRecord(record) ? (
                                      <Badge variant="outline">Permanent</Badge>
                                    ) : null}
                                    <Badge variant="outline">
                                      {getRecordTemporalBucket(record)}
                                    </Badge>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="min-w-44">
                                    <p>{formatRecordPeriod(record)}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatRemarks(record.remarks)}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={record.affectParadeState ? "default" : "outline"}
                                    className={
                                      record.affectParadeState
                                        ? "bg-emerald-800 text-white"
                                        : ""
                                    }
                                  >
                                    {record.affectParadeState ? "Impact" : "No impact"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="min-w-44">
                                    <p className="font-medium text-zinc-950">
                                      {record.submittedByName}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatTimestampLabel(record.createdAt)}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <RecordActionsMenu
                                    record={record}
                                    onEdit={() => setSelectedRecord(record)}
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

      <AddRecordDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        personnel={personnel}
        personnelError={personnelError}
        personnelLoading={isPersonnelLoading}
        submittedBy={viewer.name}
      />
      <ParadeReportModal
        open={isParadeReportOpen}
        onOpenChange={setIsParadeReportOpen}
      />
      <EditRecordDialog
        open={!!selectedRecord}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRecord(null);
          }
        }}
        record={selectedRecord}
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
        selectedRow={selectedRow}
      />
    </SidebarProvider>
  );
}
