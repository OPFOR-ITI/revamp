"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  ClipboardList,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "../../../convex/_generated/api";
import { StatusBadge } from "@/components/parade-state/status-badge";
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
  DropdownMenuItem,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
  MAX_REMARKS_LENGTH,
  PERSONNEL_ROUTE_PATH,
  STATUS_VALUES,
  type Status,
  type UserRole,
} from "@/lib/constants";
import {
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

const addRecordSchema = z
  .object({
    personnelKey: z.string().min(1, "Select a serviceman."),
    status: z.enum(STATUS_VALUES),
    affectParadeState: z.boolean(),
    startDate: z.string().min(1, "Start date is required."),
    endDate: z.string().min(1, "End date is required."),
    remarks: z
      .string()
      .max(MAX_REMARKS_LENGTH, `Remarks must be ${MAX_REMARKS_LENGTH} characters or fewer.`)
      .optional(),
  })
  .superRefine((values, ctx) => {
    if (values.endDate < values.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date must be on or after the start date.",
      });
    }
  });

const editRecordSchema = z
  .object({
    status: z.enum(STATUS_VALUES),
    affectParadeState: z.boolean(),
    startDate: z.string().min(1, "Start date is required."),
    endDate: z.string().min(1, "End date is required."),
    remarks: z
      .string()
      .max(MAX_REMARKS_LENGTH, `Remarks must be ${MAX_REMARKS_LENGTH} characters or fewer.`)
      .optional(),
  })
  .superRefine((values, ctx) => {
    if (values.endDate < values.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date must be on or after the start date.",
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
type PersonnelRouteError = { error?: { code?: string; message?: string } };

function getEmptyAddRecordValues(): AddRecordValues {
  return {
    personnelKey: "",
    status: STATUS_VALUES[0],
    affectParadeState: true,
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
            <StatusBadge status={record.status} />
            <Badge
              variant={record.affectParadeState ? "default" : "outline"}
              className={record.affectParadeState ? "bg-emerald-800 text-white" : ""}
            >
              {record.affectParadeState
                ? "Affects parade state"
                : "No parade-state impact"}
            </Badge>
          </div>
          <p className="text-sm font-medium text-zinc-900">
            {formatDateLabel(record.startDate)} to {formatDateLabel(record.endDate)}
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
  const affectParadeState = useWatch({
    control: form.control,
    name: "affectParadeState",
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
        affectParadeState: values.affectParadeState,
        startDate: values.startDate,
        endDate: values.endDate,
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
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add Parade State</DialogTitle>
          <DialogDescription>
            Create a new parade-state record using a serviceman selected from the
            live Google Sheets personnel list.
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

              <FormItem>
                <div className="flex h-full items-center justify-between rounded-2xl border border-border px-4 py-3">
                  <div>
                    <FormLabel>Affect Parade State</FormLabel>
                    <FormDescription>
                      Defaults to on for parade-state impacting records.
                    </FormDescription>
                  </div>
                  <Switch
                    checked={!!affectParadeState}
                    onCheckedChange={(checked) =>
                      form.setValue("affectParadeState", checked, {
                        shouldDirty: true,
                      })
                    }
                  />
                </div>
              </FormItem>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormItem>
                <FormLabel htmlFor="add-start-date">Start date</FormLabel>
                <FormControl>
                  <Input
                    id="add-start-date"
                    type="date"
                    {...form.register("startDate")}
                  />
                </FormControl>
                <FormMessage>{form.formState.errors.startDate?.message}</FormMessage>
              </FormItem>

              <FormItem>
                <FormLabel htmlFor="add-end-date">End date</FormLabel>
                <FormControl>
                  <Input
                    id="add-end-date"
                    type="date"
                    {...form.register("endDate")}
                  />
                </FormControl>
                <FormMessage>{form.formState.errors.endDate?.message}</FormMessage>
              </FormItem>
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
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={pickerDisabled || isSubmitting}
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
      affectParadeState: true,
      startDate: getTodaySingaporeDateString(),
      endDate: getTodaySingaporeDateString(),
      remarks: "",
    },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedStatus = useWatch({
    control: form.control,
    name: "status",
  });
  const affectParadeState = useWatch({
    control: form.control,
    name: "affectParadeState",
  });

  useEffect(() => {
    if (!record) {
      return;
    }

    form.reset({
      status: record.status,
      affectParadeState: record.affectParadeState,
      startDate: record.startDate,
      endDate: record.endDate,
      remarks: record.remarks ?? "",
    });
  }, [form, record]);

  async function onSubmit(values: EditRecordValues) {
    if (!record) {
      return;
    }

    setIsSubmitting(true);

    try {
      await updateRecord({
        recordId: record._id,
        status: values.status,
        affectParadeState: values.affectParadeState,
        startDate: values.startDate,
        endDate: values.endDate,
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
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit Record</DialogTitle>
          <DialogDescription>
            Update status, impact, dates, or remarks. Serviceman identity stays
            locked to preserve the historical snapshot.
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

                <FormItem>
                  <div className="flex h-full items-center justify-between rounded-2xl border border-border px-4 py-3">
                    <div>
                      <FormLabel>Affect Parade State</FormLabel>
                      <FormDescription>
                        Toggle whether this record counts toward parade-state impact.
                      </FormDescription>
                    </div>
                    <Switch
                      checked={!!affectParadeState}
                      onCheckedChange={(checked) =>
                        form.setValue("affectParadeState", checked, {
                          shouldDirty: true,
                        })
                      }
                    />
                  </div>
                </FormItem>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <FormItem>
                  <FormLabel htmlFor="edit-start-date">Start date</FormLabel>
                  <FormControl>
                    <Input
                      id="edit-start-date"
                      type="date"
                      {...form.register("startDate")}
                    />
                  </FormControl>
                  <FormMessage>{form.formState.errors.startDate?.message}</FormMessage>
                </FormItem>

                <FormItem>
                  <FormLabel htmlFor="edit-end-date">End date</FormLabel>
                  <FormControl>
                    <Input
                      id="edit-end-date"
                      type="date"
                      {...form.register("endDate")}
                    />
                  </FormControl>
                  <FormMessage>{form.formState.errors.endDate?.message}</FormMessage>
                </FormItem>
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
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
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

  useEffect(() => {
    if (!record) {
      return;
    }

    const today = getTodaySingaporeDateString();
    form.reset({
      endDate: today >= record.startDate ? today : record.startDate,
    });
  }, [form, record]);

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
      <DialogContent>
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
                  Current range: {formatDateLabel(record.startDate)} to{" "}
                  {formatDateLabel(record.endDate)}
                </p>
              </div>

              <FormItem>
                <FormLabel htmlFor="adjust-end-date">New end date</FormLabel>
                <FormControl>
                  <Input
                    id="adjust-end-date"
                    type="date"
                    min={record.startDate}
                    {...form.register("endDate")}
                  />
                </FormControl>
                <FormMessage>{form.formState.errors.endDate?.message}</FormMessage>
              </FormItem>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
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
      <SheetContent className="overflow-y-auto sm:max-w-xl">
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

function OverviewCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="border-emerald-950/10 bg-white/80 shadow-lg shadow-emerald-950/5">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardDescription>{title}</CardDescription>
          <CardTitle className="mt-2 text-3xl">{value}</CardTitle>
        </div>
        <div className="rounded-2xl bg-emerald-950/[0.06] p-3 text-emerald-900">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="pt-0 text-sm text-zinc-600">
        {description}
      </CardContent>
    </Card>
  );
}

export function OperationsDashboard({
  viewer,
}: {
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
  const activeRecordCount = currentState.reduce(
    (sum, row) => sum + row.activeRecordCount,
    0,
  );
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
      ? `${record.rank} ${record.name} ${record.platoon} ${formatDesignation(record.designation)}`
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

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(79,120,67,0.14),_transparent_42%),linear-gradient(180deg,_#f4f0e3_0%,_#ebe5d4_45%,_#e1e7d9_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[28px] border border-emerald-950/10 bg-[linear-gradient(135deg,_rgba(49,80,42,0.96),_rgba(87,103,53,0.88))] px-6 py-6 text-white shadow-2xl shadow-emerald-950/10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-100/70">
                Revamp - Daily operations board
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {viewer.role === "admin" ? (
                <Link
                  href="/admin/users"
                  className={buttonVariants({
                    variant: "secondary",
                    size: "sm",
                    className: "bg-white/12 text-white hover:bg-white/18",
                  })}
                >
                  <ShieldCheck className="size-4" />
                  User approvals
                </Link>
              ) : null}
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/12 text-white hover:bg-white/18"
                onClick={handleRefreshPersonnel}
                disabled={isPersonnelLoading}
              >
                {isPersonnelLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Refresh personnel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/12 text-white hover:bg-white/18"
                onClick={handleSignOut}
                disabled={isSigningOut}
              >
                {isSigningOut ? <Loader2 className="size-4 animate-spin" /> : null}
                Sign out
              </Button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-emerald-50/85">
            <Badge className="bg-white/12 text-white">Approved {viewer.role}</Badge>
            <span className="inline-flex items-center gap-2">
              <UserRound className="size-4" />
              {viewer.name}
            </span>
            <span className="text-emerald-100/70">{viewer.email}</span>
          </div>
        </section>

        {personnelError ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Personnel refresh failed: {personnelError}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <OverviewCard
            title="Nominal Roll"
            value={isPersonnelLoading && !personnel.length ? "--" : personnel.length}
            description="Current personnel rows from the linked Personnel sheet."
            icon={<UserRound className="size-5" />}
          />
          <OverviewCard
            title="Currently Affected"
            value={currentStateQuery === undefined ? "--" : currentState.length}
            description="Distinct servicemen with at least one active inclusive-date record."
            icon={<ShieldCheck className="size-5" />}
          />
          <OverviewCard
            title="Active Records"
            value={currentStateQuery === undefined ? "--" : activeRecordCount}
            description="Total active parade-state records, including overlaps."
            icon={<ClipboardList className="size-5" />}
          />
        </section>

        <section className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-zinc-950">
              Operations
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Manage parade-state records without editing personnel in-app.
            </p>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="size-4" />
            Add Parade State
          </Button>
        </section>

        <Tabs defaultValue="current-state" className="gap-4">
          <TabsList variant="line">
            <TabsTrigger value="current-state">Current State</TabsTrigger>
            <TabsTrigger value="record-log">Record Log</TabsTrigger>
          </TabsList>

          <TabsContent value="current-state">
            <Card className="border-emerald-950/10 bg-white/80 shadow-lg shadow-emerald-950/5">
              <CardHeader>
                <CardTitle>Distinct Current State</CardTitle>
                <CardDescription>
                  One row per serviceman with all currently active overlapping
                  statuses grouped together.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {currentStateQuery === undefined ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full rounded-xl" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                  </div>
                ) : currentState.length ? (
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
                                <StatusBadge key={`${row.personnelKey}-${status}`} status={status} />
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
                ) : (
                  <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    No active parade-state records today.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="record-log">
            <Card className="border-emerald-950/10 bg-white/80 shadow-lg shadow-emerald-950/5">
              <CardHeader>
                <CardTitle>Record Log</CardTitle>
                <CardDescription>
                  Full historical log with client-side filters for status, platoon,
                  impact, and time bucket.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 rounded-2xl border border-border bg-background/80 p-4 lg:grid-cols-[2fr,1fr,1fr,1fr,1fr]">
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
                              <StatusBadge status={record.status} />
                              <Badge variant="outline">
                                {getRecordTemporalBucket(record)}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="min-w-44">
                              <p>
                                {formatDateLabel(record.startDate)} to{" "}
                                {formatDateLabel(record.endDate)}
                              </p>
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
                                <DropdownMenuItem onClick={() => setSelectedRecord(record)}>
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setRecordForEndDateAdjust(record)}
                                >
                                  Adjust end date
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    No records match the current filters.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AddRecordDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        personnel={personnel}
        personnelError={personnelError}
        personnelLoading={isPersonnelLoading}
        submittedBy={viewer.name}
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
    </main>
  );
}
