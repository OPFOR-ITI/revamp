"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";

import { api } from "../../../convex/_generated/api";
import { PersonnelCombobox } from "@/components/parade-state/personnel-combobox";
import type {
  DutyAssignmentDoc,
  DutyAssignmentFormData,
  DutyCalendarDayGroup,
} from "@/components/duties/types";
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
  Form,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  DUTY_COLOR_CLASSES,
  DUTY_KIND_VALUES,
  DUTY_PRESETS,
  dutyAssignmentFormSchema,
  getDefaultDutyPoints,
  getDutyColorKey,
  getDutyEligibilityDescription,
  getDutyKindFromPreset,
  getDutyPresetFromKind,
  isEligibleForDuty,
  sanitizeDutyType,
  type DutyKind,
} from "@/lib/duties";
import { PERSONNEL_ROUTE_PATH } from "@/lib/constants";
import {
  formatDateLabel,
  getTodaySingaporeDateString,
} from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  formatDesignation,
  personnelRecordSchema,
  type PersonnelRecord,
} from "@/lib/personnel";

type PersonnelRouteError = { error?: { code?: string; message?: string } };

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function dateToString(value: Date) {
  return format(value, "yyyy-MM-dd");
}

function formatPointsLabel(points: number) {
  return `${Number.isInteger(points) ? points.toFixed(0) : points.toFixed(1)} pt`;
}

function getDutyTypeFromForm(values: DutyAssignmentFormData) {
  const dutyPreset = getDutyPresetFromKind(values.dutyKind);

  if (dutyPreset) {
    return dutyPreset;
  }

  return sanitizeDutyType(values.customDutyType ?? "");
}

function getCreateDefaultValues(dateOfDuty: string): DutyAssignmentFormData {
  return {
    dutyKind: DUTY_PRESETS[0],
    customDutyType: "",
    personnelKey: "",
    dateOfDuty,
    points: getDefaultDutyPoints(dateOfDuty),
    isExtra: false,
  };
}

function getEditDefaultValues(assignment: DutyAssignmentDoc): DutyAssignmentFormData {
  return {
    dutyKind: getDutyKindFromPreset(assignment.dutyPreset),
    customDutyType: assignment.dutyPreset ? "" : assignment.dutyType,
    personnelKey: assignment.personnelKey,
    dateOfDuty: assignment.dateOfDuty,
    points: assignment.points,
    isExtra: assignment.isExtra,
  };
}

function DateField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const selectedDate = value ? parseISO(value) : undefined;

  return (
    <FormItem>
      <FormLabel>Date of Duty</FormLabel>
      <Popover>
        <PopoverTrigger
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-10 w-full justify-between px-3 text-left font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <span>{value ? formatDateLabel(value) : "Select date"}</span>
          <CalendarDays className="size-4 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(nextDate) => {
              if (nextDate) {
                onChange(dateToString(nextDate));
              }
            }}
          />
        </PopoverContent>
      </Popover>
      <FormMessage>{error}</FormMessage>
    </FormItem>
  );
}

function PersonnelPreview({ personnel }: { personnel?: PersonnelRecord }) {
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
    </div>
  );
}

function DutyLegend() {
  return (
    <div className="flex flex-wrap gap-2">
      {[
        { label: "CDO", key: "CDO" as const },
        { label: "DOO", key: "DOO" as const },
        { label: "CDS", key: "CDS" as const },
        { label: "COS", key: "COS" as const },
        { label: "Custom", key: "CUSTOM" as const },
      ].map((item) => (
        <span
          key={item.label}
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
            DUTY_COLOR_CLASSES[item.key],
          )}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}

function DutyAssignmentButton({
  assignment,
  onClick,
}: {
  assignment: DutyAssignmentDoc;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        "grid gap-1 rounded-xl border px-2 py-2 text-left transition-colors hover:brightness-[0.98]",
        DUTY_COLOR_CLASSES[getDutyColorKey(assignment.dutyPreset)],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-xs font-semibold uppercase tracking-[0.14em]">
          {assignment.dutyType}
        </span>
        <span className="shrink-0 text-[11px] font-semibold">
          {formatPointsLabel(assignment.points)}
        </span>
      </div>
      <span className="truncate text-sm font-medium">
        {assignment.rank} {assignment.name}
      </span>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="truncate">{assignment.platoon}</span>
        {assignment.isExtra ? (
          <span className="rounded-full border border-current/20 px-1.5 py-0.5 font-medium uppercase tracking-[0.14em]">
            Extra
          </span>
        ) : null}
      </div>
    </button>
  );
}

function DutyAssignmentDialog({
  open,
  onOpenChange,
  assignment,
  initialDate,
  personnel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: DutyAssignmentDoc | null;
  initialDate: string;
  personnel: PersonnelRecord[];
}) {
  const createAssignment = useMutation(api.duties.createAssignment);
  const updateAssignment = useMutation(api.duties.updateAssignment);
  const deleteAssignment = useMutation(api.duties.deleteAssignment);
  const form = useForm<DutyAssignmentFormData>({
    resolver: zodResolver(dutyAssignmentFormSchema),
    defaultValues: getCreateDefaultValues(initialDate),
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isPointsManualRef = useRef(false);

  const selectedDutyKind = useWatch({
    control: form.control,
    name: "dutyKind",
  });
  const selectedPersonnelKey = useWatch({
    control: form.control,
    name: "personnelKey",
  });
  const selectedDate = useWatch({
    control: form.control,
    name: "dateOfDuty",
  });
  const customDutyType = useWatch({
    control: form.control,
    name: "customDutyType",
  });
  const isExtra = useWatch({
    control: form.control,
    name: "isExtra",
  });
  const points = useWatch({
    control: form.control,
    name: "points",
  });

  const dutyPreset = getDutyPresetFromKind(selectedDutyKind);
  const filteredPersonnel = personnel.filter((person) =>
    isEligibleForDuty({
      dutyPreset,
      rank: person.rank,
      designation: person.designation,
    }),
  );
  const selectedPersonnel = personnel.find(
    (person) => person.personnelKey === selectedPersonnelKey,
  );
  const pickerDisabled = personnel.length === 0 || filteredPersonnel.length === 0;

  useEffect(() => {
    if (!open) {
      return;
    }

    if (assignment) {
      form.reset(getEditDefaultValues(assignment));
      isPointsManualRef.current = true;
    } else {
      form.reset(getCreateDefaultValues(initialDate));
      isPointsManualRef.current = false;
    }
  }, [assignment, form, initialDate, open]);

  useEffect(() => {
    if (dutyPreset) {
      form.setValue("customDutyType", "", {
        shouldDirty: false,
        shouldValidate: false,
      });
    }

    if (
      selectedPersonnel &&
      !isEligibleForDuty({
        dutyPreset,
        rank: selectedPersonnel.rank,
        designation: selectedPersonnel.designation,
      })
    ) {
      form.setValue("personnelKey", "", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [dutyPreset, form, selectedPersonnel]);

  useEffect(() => {
    if (!selectedDate || isExtra || isPointsManualRef.current) {
      return;
    }

    form.setValue("points", getDefaultDutyPoints(selectedDate), {
      shouldDirty: false,
      shouldValidate: true,
    });
  }, [form, isExtra, selectedDate]);

  function handleExtraChange(nextValue: boolean) {
    form.setValue("isExtra", nextValue, {
      shouldDirty: true,
      shouldValidate: true,
    });

    if (nextValue) {
      isPointsManualRef.current = false;
      form.setValue("points", 0, {
        shouldDirty: true,
        shouldValidate: true,
      });
      return;
    }

    isPointsManualRef.current = false;
    form.setValue("points", getDefaultDutyPoints(form.getValues("dateOfDuty")), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function handleUseDefaultPoints() {
    const dateOfDuty = form.getValues("dateOfDuty");

    if (!dateOfDuty || isExtra) {
      return;
    }

    isPointsManualRef.current = false;
    form.setValue("points", getDefaultDutyPoints(dateOfDuty), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function buildMutationPayload(values: DutyAssignmentFormData) {
    if (!selectedPersonnel) {
      form.setError("personnelKey", {
        message: "Select a serviceman before saving.",
      });
      return null;
    }

    const dutyType = getDutyTypeFromForm(values);

    return {
      personnelKey: selectedPersonnel.personnelKey,
      rank: selectedPersonnel.rank,
      name: selectedPersonnel.name,
      platoon: selectedPersonnel.platoon,
      designation: selectedPersonnel.designation,
      dutyType,
      dutyPreset: getDutyPresetFromKind(values.dutyKind),
      dateOfDuty: values.dateOfDuty,
      points: values.isExtra ? 0 : values.points,
      isExtra: values.isExtra,
    };
  }

  async function handleSubmit(values: DutyAssignmentFormData) {
    const payload = buildMutationPayload(values);

    if (!payload) {
      return;
    }

    setIsSaving(true);

    try {
      if (assignment) {
        await updateAssignment({
          assignmentId: assignment._id,
          ...payload,
        });
        toast.success("Duty assignment updated.");
      } else {
        await createAssignment(payload);
        toast.success("Duty assignment created.");
      }

      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save duty assignment.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!assignment) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteAssignment({ assignmentId: assignment._id });
      toast.success("Duty assignment deleted.");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete duty assignment.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {assignment ? "Edit Duty Assignment" : "Assign Duty"}
          </DialogTitle>
          <DialogDescription>
            {assignment
              ? "Update the assignee, duty type, date, and points for this duty."
              : "Create a new duty assignment with preset eligibility checks and default points."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="space-y-5"
            onSubmit={form.handleSubmit(handleSubmit)}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <FormItem>
                <FormLabel>Duty Type</FormLabel>
                <Select
                  value={selectedDutyKind}
                  onValueChange={(value) =>
                    form.setValue("dutyKind", value as DutyKind, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder="Select duty type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DUTY_KIND_VALUES.map((dutyKind) => (
                      <SelectItem key={dutyKind} value={dutyKind}>
                        {dutyKind === "CUSTOM" ? "Custom" : dutyKind}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  {getDutyEligibilityDescription(dutyPreset)}
                </FormDescription>
              </FormItem>

              {selectedDutyKind === "CUSTOM" ? (
                <FormItem>
                  <FormLabel>Custom Duty Name</FormLabel>
                  <Input
                    value={customDutyType ?? ""}
                    maxLength={100}
                    placeholder="e.g. Guard Duty"
                    onChange={(event) =>
                      form.setValue("customDutyType", event.target.value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  />
                  <FormMessage>
                    {form.formState.errors.customDutyType?.message}
                  </FormMessage>
                </FormItem>
              ) : (
                <div className="hidden sm:block" />
              )}
            </div>

            <FormItem>
              <FormLabel>Serviceman</FormLabel>
              <PersonnelCombobox
                personnel={filteredPersonnel}
                value={selectedPersonnelKey}
                onChange={(nextValue) =>
                  form.setValue("personnelKey", nextValue, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                disabled={pickerDisabled}
              />
              <FormDescription>
                {dutyPreset
                  ? `${filteredPersonnel.length} eligible personnel available for ${dutyPreset}.`
                  : `${filteredPersonnel.length} personnel available.`}
              </FormDescription>
              <FormMessage>{form.formState.errors.personnelKey?.message}</FormMessage>
            </FormItem>

            <PersonnelPreview personnel={selectedPersonnel} />

            <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <DateField
                value={selectedDate}
                onChange={(value) =>
                  form.setValue("dateOfDuty", value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                error={form.formState.errors.dateOfDuty?.message}
              />

              <FormItem>
                <div className="flex items-center justify-between rounded-2xl border border-border px-4 py-3">
                  <div className="space-y-1">
                    <FormLabel>Extra Duty</FormLabel>
                  </div>
                  <Switch checked={isExtra} onCheckedChange={handleExtraChange} />
                </div>
              </FormItem>
            </div>

            <FormItem>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <FormLabel htmlFor="duty-points">Points</FormLabel>
                  <FormDescription>
                    Defaults follow the selected weekday. You can override unless
                    the duty is marked as extra.
                  </FormDescription>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleUseDefaultPoints}
                  disabled={isExtra}
                >
                  <RotateCcw className="size-4" />
                  Use default
                </Button>
              </div>
              <Input
                id="duty-points"
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                value={Number.isFinite(points) ? String(points) : ""}
                disabled={isExtra}
                onChange={(event) => {
                  isPointsManualRef.current = true;
                  form.setValue(
                    "points",
                    event.target.value === ""
                      ? Number.NaN
                      : Number(event.target.value),
                    {
                      shouldDirty: true,
                      shouldValidate: true,
                    },
                  );
                }}
              />
              <FormMessage>{form.formState.errors.points?.message}</FormMessage>
            </FormItem>

            {assignment && confirmDelete ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm font-medium text-destructive">
                  Delete this duty assignment?
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  This action removes the assignment from the calendar immediately.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      void handleDelete();
                    }}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                    Confirm delete
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfirmDelete(false)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            <DialogFooter className="gap-2">
              {assignment ? (
                <Button
                  type="button"
                  variant="outline"
                  className="sm:mr-auto"
                  onClick={() => setConfirmDelete(true)}
                  disabled={isSaving || isDeleting}
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              ) : null}
              <Button type="submit" disabled={isSaving || isDeleting}>
                {isSaving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {assignment ? "Save changes" : "Create assignment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function DutyCalendarPage() {
  const [personnel, setPersonnel] = useState<PersonnelRecord[]>([]);
  const [personnelError, setPersonnelError] = useState<string | null>(null);
  const [personnelRefreshKey, setPersonnelRefreshKey] = useState(0);
  const [isPersonnelLoading, setIsPersonnelLoading] = useState(true);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(parseISO(getTodaySingaporeDateString())),
  );
  const [selectedDate, setSelectedDate] = useState(getTodaySingaporeDateString());
  const [selectedAssignment, setSelectedAssignment] =
    useState<DutyAssignmentDoc | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const gridStart = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 1 });
  const visibleFromDate = dateToString(gridStart);
  const visibleToDate = dateToString(gridEnd);
  const assignments = useQuery(api.duties.listAssignmentsForRange, {
    fromDate: visibleFromDate,
    toDate: visibleToDate,
  }) as DutyAssignmentDoc[] | undefined;

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

  const canManageAssignments =
    !isPersonnelLoading && !personnelError && personnel.length > 0;

  const assignmentsByDate = new Map<string, DutyAssignmentDoc[]>();

  for (const assignment of assignments ?? []) {
    const existing = assignmentsByDate.get(assignment.dateOfDuty) ?? [];
    existing.push(assignment);
    assignmentsByDate.set(assignment.dateOfDuty, existing);
  }

  const dayGroups: DutyCalendarDayGroup[] = [];
  let currentDate = gridStart;

  while (currentDate <= gridEnd) {
    const dateKey = dateToString(currentDate);

    dayGroups.push({
      date: currentDate,
      dateKey,
      inCurrentMonth: isSameMonth(currentDate, visibleMonth),
      isToday: isToday(currentDate),
      assignments: assignmentsByDate.get(dateKey) ?? [],
    });

    currentDate = addDays(currentDate, 1);
  }

  function openCreateDialog(dateOfDuty: string) {
    if (!canManageAssignments) {
      toast.error("Personnel must load successfully before assignments can be managed.");
      return;
    }

    setSelectedAssignment(null);
    setSelectedDate(dateOfDuty);
    setIsDialogOpen(true);
  }

  function openEditDialog(assignment: DutyAssignmentDoc) {
    if (!canManageAssignments) {
      toast.error("Personnel must load successfully before assignments can be managed.");
      return;
    }

    setSelectedAssignment(assignment);
    setSelectedDate(assignment.dateOfDuty);
    setIsDialogOpen(true);
  }

  return (
    <>
      <Card className="border-emerald-950/10 bg-white/80">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <CardTitle>Monthly duty board</CardTitle>
            <CardDescription>
              All duty assignments are visible directly on the calendar. Click
              an empty day to assign a duty or select an existing assignment to
              edit it.
            </CardDescription>
            <DutyLegend />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setVisibleMonth((current) => subMonths(current, 1))}
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setVisibleMonth(startOfMonth(parseISO(getTodaySingaporeDateString())))
              }
            >
              Today
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
            <Button
              type="button"
              onClick={() => openCreateDialog(getTodaySingaporeDateString())}
              disabled={!canManageAssignments}
            >
              Assign duty
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">
                {format(visibleMonth, "MMMM yyyy")}
              </h2>
              <p className="text-sm text-muted-foreground">
                Week starts on Monday. Outside-month days remain visible for full-week planning.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isPersonnelLoading ? (
                <Badge variant="outline">Loading personnel</Badge>
              ) : null}
              {personnel.length ? (
                <Badge variant="outline">{personnel.length} personnel loaded</Badge>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPersonnelRefreshKey((value) => value + 1)}
                disabled={isPersonnelLoading}
              >
                {isPersonnelLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RotateCcw className="size-4" />
                )}
                Refresh personnel
              </Button>
            </div>
          </div>

          {personnelError ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Personnel refresh failed: {personnelError} Existing assignments are
              still visible, but add/edit actions stay disabled until personnel
              data loads successfully.
            </div>
          ) : null}

          <div className="grid grid-cols-7 gap-2">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="rounded-xl border border-emerald-950/10 bg-emerald-950/[0.03] px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-emerald-900/60"
              >
                {label}
              </div>
            ))}
          </div>

          {assignments === undefined ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 12 }).map((_, index) => (
                <Skeleton key={index} className="h-40 rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
              {dayGroups.map((day) => (
                <div
                  key={day.dateKey}
                  onClick={() => openCreateDialog(day.dateKey)}
                  className={cn(
                    "flex min-h-36 cursor-pointer flex-col gap-3 rounded-2xl border p-3 text-left transition-colors hover:border-emerald-700/30 hover:bg-emerald-950/[0.025]",
                    day.inCurrentMonth
                      ? "border-emerald-950/10 bg-white/70"
                      : "border-zinc-200/80 bg-zinc-50/70 text-muted-foreground",
                    day.isToday && "ring-2 ring-emerald-700/25",
                  )}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openCreateDialog(day.dateKey);
                    }
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex size-8 items-center justify-center rounded-full text-sm font-semibold",
                          day.isToday
                            ? "bg-emerald-800 text-white"
                            : "bg-emerald-950/[0.05] text-zinc-950",
                        )}
                      >
                        {format(day.date, "d")}
                      </span>
                      <span className="text-xs font-medium uppercase tracking-[0.16em]">
                        {format(day.date, "MMM")}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {day.assignments.length}
                      {day.assignments.length === 1 ? " duty" : " duties"}
                    </span>
                  </div>

                  <div className="grid gap-2">
                    {day.assignments.length ? (
                      day.assignments.map((assignment) => (
                        <DutyAssignmentButton
                          key={assignment._id}
                          assignment={assignment}
                          onClick={() => openEditDialog(assignment)}
                        />
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                        No duties assigned.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <DutyAssignmentDialog
        key={`${selectedAssignment?._id ?? selectedDate}-${isDialogOpen ? "open" : "closed"}`}
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);

          if (!open) {
            setSelectedAssignment(null);
          }
        }}
        assignment={selectedAssignment}
        initialDate={selectedDate}
        personnel={personnel}
      />
    </>
  );
}
