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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { DateStepperField } from "@/components/ui/date-stepper-field";
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
  isZeroPointDutyPreset,
  resolveDutyPoints,
  sanitizeDutyType,
  type DutyKind,
  type DutyPreset,
} from "@/lib/duties";
import { PERSONNEL_ROUTE_PATH } from "@/lib/constants";
import {
  getTodaySingaporeDateString,
} from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  formatDesignation,
  getPersonnelDisplayName,
  personnelRecordSchema,
  type PersonnelRecord,
} from "@/lib/personnel";

type PersonnelRouteError = { error?: { code?: string; message?: string } };

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function dateToString(value: Date) {
  return format(value, "yyyy-MM-dd");
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
    points: getDefaultDutyPoints(dateOfDuty, DUTY_PRESETS[0]),
    isExtra: false,
  };
}

function getEditDefaultValues(assignment: DutyAssignmentDoc): DutyAssignmentFormData {
  return {
    dutyKind: getDutyKindFromPreset(assignment.dutyPreset),
    customDutyType: assignment.dutyPreset ? "" : assignment.dutyType,
    personnelKey: assignment.personnelKey,
    dateOfDuty: assignment.dateOfDuty,
    points: resolveDutyPoints({
      dutyPreset: assignment.dutyPreset,
      points: assignment.points,
      isExtra: assignment.isExtra,
    }),
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
  return (
    <DateStepperField
      label="Date of Duty"
      value={value}
      onChange={onChange}
      error={error}
    />
  );
}

function formatDutyPersonnelName(personnel: {
  name: string;
  alias?: string;
}) {
  return getPersonnelDisplayName(personnel);
}

function getDutyAssignmentDisplayName(
  assignment: Pick<DutyAssignmentDoc, "personnelKey" | "name">,
  personnelByKey: Map<string, PersonnelRecord>,
) {
  return formatDutyPersonnelName(
    personnelByKey.get(assignment.personnelKey) ?? assignment,
  );
}

function PersonnelPreview({
  personnel,
}: {
  personnel?: PersonnelRecord;
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
    </div>
  );
}

type DutyColorKey = DutyPreset | "CUSTOM";

const DUTY_FILTER_ITEMS: { label: string; key: DutyColorKey }[] = [
  { label: "CDO", key: "CDO" },
  { label: "DOO", key: "DOO" },
  { label: "CDS", key: "CDS" },
  { label: "COS", key: "COS" },
  { label: "COS RES", key: "COS RESERVE" },
  { label: "Custom", key: "CUSTOM" },
];

const ALL_DUTY_FILTER_KEYS = new Set<DutyColorKey>(
  DUTY_FILTER_ITEMS.map((item) => item.key),
);

const DUTY_DOT_BG: Record<DutyColorKey, string> = {
  CDO: "bg-cyan-500",
  DOO: "bg-sky-500",
  CDS: "bg-amber-500",
  COS: "bg-emerald-500",
  "COS RESERVE": "bg-emerald-800",
  CUSTOM: "bg-zinc-400",
};

function DutyFilter({
  activeFilters,
  onToggle,
}: {
  activeFilters: Set<DutyColorKey>;
  onToggle: (key: DutyColorKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {DUTY_FILTER_ITEMS.map((item) => {
        const isActive = activeFilters.has(item.key);

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onToggle(item.key)}
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
              isActive
                ? DUTY_COLOR_CLASSES[item.key]
                : "border-zinc-200 bg-zinc-50 text-zinc-400 line-through",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function DutyAssignmentButton({
  assignment,
  displayName,
  canManageAssignments,
  onClick,
}: {
  assignment: DutyAssignmentDoc;
  displayName: string;
  canManageAssignments: boolean;
  onClick: () => void;
}) {
  const className = cn(
    "grid gap-1 rounded-xl border px-[10px] py-[4px] text-left",
    canManageAssignments && "transition-colors hover:brightness-[0.98]",
    DUTY_COLOR_CLASSES[getDutyColorKey(assignment.dutyPreset)],
  );

  if (!canManageAssignments) {
    return (
      <div className={className}>
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-xs font-semibold uppercase tracking-[0.14em]">
            {assignment.dutyType}
          </span>
          <span className="shrink-0 text-[11px] font-semibold" />
        </div>
        <span className="truncate text-sm font-medium">
          {assignment.rank} {displayName}
        </span>
        <div className="flex items-center justify-between gap-2 text-[11px]">
          {assignment.isExtra ? (
            <span className="rounded-full border border-current/20 px-1.5 py-0.5 font-medium uppercase tracking-[0.14em]">
              Extra
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={className}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-[9px] font-semibold uppercase tracking-[0.14em]">
          {assignment.dutyType}
        </span>
        <span className="shrink-0 text-[11px] font-semibold">
          {/* hide points */}
          {/* {formatPointsLabel(
            resolveDutyPoints({
              dutyPreset: assignment.dutyPreset,
              points: assignment.points,
              isExtra: assignment.isExtra,
            }),
          )} */}
        </span>
        {assignment.isExtra ? (
          <span className="rounded-full border border-current/20 px-1.5 text-[9px] uppercase text-red-500 bg-red-100">
            Extra
          </span>
        ) : null}
      </div>
      <span className="truncate text-[11px] font-medium">
        {assignment.rank} {displayName}
      </span>
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
  const isZeroPointDuty = isZeroPointDutyPreset(dutyPreset);
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

    form.setValue("points", getDefaultDutyPoints(selectedDate, dutyPreset), {
      shouldDirty: false,
      shouldValidate: true,
    });
  }, [dutyPreset, form, isExtra, selectedDate]);

  useEffect(() => {
    if (!isZeroPointDuty || isExtra) {
      return;
    }

    isPointsManualRef.current = false;
    form.setValue("points", 0, {
      shouldDirty: false,
      shouldValidate: true,
    });
  }, [form, isExtra, isZeroPointDuty]);

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
    form.setValue("points", getDefaultDutyPoints(form.getValues("dateOfDuty"), dutyPreset), {
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
    form.setValue("points", getDefaultDutyPoints(dateOfDuty, dutyPreset), {
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
    const nextDutyPreset = getDutyPresetFromKind(values.dutyKind);

    return {
      personnelKey: selectedPersonnel.personnelKey,
      rank: selectedPersonnel.rank,
      name: selectedPersonnel.name,
      platoon: selectedPersonnel.platoon,
      designation: selectedPersonnel.designation,
      dutyType,
      dutyPreset: nextDutyPreset,
      dateOfDuty: values.dateOfDuty,
      points: resolveDutyPoints({
        dutyPreset: nextDutyPreset,
        points: values.points,
        isExtra: values.isExtra,
      }),
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
      <DialogContent className="max-h-[calc(100svh-1rem)] overflow-y-auto sm:max-w-3xl">
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
                    {isZeroPointDuty
                      ? "This duty does not award points."
                      : "Defaults follow the selected weekday. You can override unless the duty is marked as extra."}
                  </FormDescription>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleUseDefaultPoints}
                  disabled={isExtra || isZeroPointDuty}
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
                disabled={isExtra || isZeroPointDuty}
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
              <Button
                type="submit"
                disabled={isSaving || isDeleting}
                className="w-full sm:w-auto"
              >
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

export function DutyCalendarPage({
  canManageAssignments,
}: {
  canManageAssignments: boolean;
}) {
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
  const [activeFilters, setActiveFilters] = useState<Set<DutyColorKey>>(
    () => new Set(ALL_DUTY_FILTER_KEYS),
  );
  const scrollPositionRef = useRef(0);

  function handleFilterToggle(key: DutyColorKey) {
    setActiveFilters((prev) => {
      const next = new Set(prev);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }

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

  const canOpenAssignmentEditor =
    canManageAssignments &&
    !isPersonnelLoading && !personnelError && personnel.length > 0;
  const personnelByKey = new Map(
    personnel.map((person) => [person.personnelKey, person] as const),
  );

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
      return;
    }

    if (!canOpenAssignmentEditor) {
      toast.error("Personnel must load successfully before assignments can be managed.");
      return;
    }

    scrollPositionRef.current = window.scrollY;
    setSelectedAssignment(null);
    setSelectedDate(dateOfDuty);
    setIsDialogOpen(true);
  }

  function openEditDialog(assignment: DutyAssignmentDoc) {
    if (!canManageAssignments) {
      return;
    }

    if (!canOpenAssignmentEditor) {
      toast.error("Personnel must load successfully before assignments can be managed.");
      return;
    }

    scrollPositionRef.current = window.scrollY;
    setSelectedAssignment(assignment);
    setSelectedDate(assignment.dateOfDuty);
    setIsDialogOpen(true);
  }

  return (
    <>
      <Card className="border-emerald-950/10 bg-white/80">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">
                {format(visibleMonth, "MMMM yyyy")}
              </h2>
            <DutyFilter activeFilters={activeFilters} onToggle={handleFilterToggle} />
          </div>

          <div className="flex flex-wrap gap-2">
              {personnel.length ? (
                <Badge variant="outline" className="h-8">{personnel.length} pax</Badge>
              ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => setVisibleMonth((current) => subMonths(current, 1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setVisibleMonth(startOfMonth(parseISO(getTodaySingaporeDateString())))
              }
            >
              This Month
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
            {canManageAssignments ? (
              <Button
                type="button"
                onClick={() => openCreateDialog(getTodaySingaporeDateString())}
                disabled={!canOpenAssignmentEditor}
              >
                Assign duty
              </Button>
            ) : (
              <Badge variant="outline">View only</Badge>
            )}
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setPersonnelRefreshKey((value) => value + 1)}
                disabled={isPersonnelLoading}
              >
                {isPersonnelLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RotateCcw className="size-4" />
                )}
              </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {personnelError ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Personnel refresh failed: {personnelError} Existing assignments are
              still visible, but add/edit actions stay disabled until personnel
              data loads successfully.
            </div>
          ) : null}

          <div className="grid grid-cols-7 gap-0 md:gap-2">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="py-1 text-center text-[10px] font-semibold uppercase text-zinc-400 md:rounded-xl md:border md:border-emerald-950/10 md:bg-emerald-950/[0.03] md:px-3 md:py-2 md:text-xs md:tracking-[0.2em] md:text-emerald-900/60"
              >
                <span className="md:hidden">{label[0]}</span>
                <span className="hidden md:inline">{label}</span>
              </div>
            ))}
          </div>

          {assignments === undefined ? (
            <>
              <div className="grid grid-cols-7 gap-0 md:hidden">
                {Array.from({ length: 35 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 rounded-none" />
                ))}
              </div>
              <div className="hidden md:grid md:grid-cols-7 md:gap-2">
                {Array.from({ length: 35 }).map((_, index) => (
                  <Skeleton key={index} className="h-28 rounded-2xl" />
                ))}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-7 gap-0 md:gap-2">
              {dayGroups.map((day) => {
                const visibleAssignments = day.assignments.filter((a) =>
                  activeFilters.has(getDutyColorKey(a.dutyPreset)),
                );

                return (
                  <div
                    key={day.dateKey}
                    className={cn(
                      "flex flex-col text-left",
                      // Mobile: compact cell with bottom separator
                      "gap-[3px] px-[2px] pb-1 pt-[3px] border-b border-zinc-200/70",
                      // Desktop: expanded card style
                      "md:gap-3 md:rounded-2xl md:border md:p-1 md:min-h-16 md:pb-1",
                      // Interactions
                      canManageAssignments &&
                        "cursor-pointer transition-colors md:hover:border-emerald-700/30 md:hover:bg-emerald-950/[0.025]",
                      // Month context
                      day.inCurrentMonth
                        ? "md:border-emerald-950/10 md:bg-white/70"
                        : "md:border-zinc-200/80 md:bg-zinc-50/70",
                      !day.inCurrentMonth && "text-muted-foreground",
                      // Today highlight
                      day.isToday && "md:ring-2 md:ring-emerald-700/25",
                    )}
                    onClick={
                      canManageAssignments
                        ? () => openCreateDialog(day.dateKey)
                        : undefined
                    }
                    role={canManageAssignments ? "button" : undefined}
                    tabIndex={canManageAssignments ? 0 : undefined}
                    onKeyDown={
                      canManageAssignments
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openCreateDialog(day.dateKey);
                            }
                          }
                        : undefined
                    }
                  >
                    {/* ── Mobile: date number ── */}
                    <span
                      className={cn(
                        "inline-flex size-6 items-center justify-center self-center rounded-full text-[11px] font-semibold md:hidden",
                        day.isToday
                          ? "bg-emerald-700 text-white"
                          : day.inCurrentMonth
                            ? "text-zinc-900"
                            : "text-zinc-400",
                      )}
                    >
                      {format(day.date, "d")}
                    </span>

                    {/* ── Mobile: inline duty labels ── */}
                    {visibleAssignments.length > 0 && (
                      <div className="flex flex-col gap-[2px] min-w-0 md:hidden">
                        {visibleAssignments.map((a) => {
                          const displayName = getDutyAssignmentDisplayName(
                            a,
                            personnelByKey,
                          );

                          return (
                          <div
                            key={a._id}
                            role={canManageAssignments ? "button" : undefined}
                            tabIndex={canManageAssignments ? 0 : undefined}
                            onClick={
                              canManageAssignments
                                ? (e) => {
                                    e.stopPropagation();
                                    openEditDialog(a);
                                  }
                                : undefined
                            }
                            className="flex items-center gap-[3px] min-w-0"
                          >
                            <span
                              className={cn(
                                "size-[6px] shrink-0 rounded-full",
                                DUTY_DOT_BG[getDutyColorKey(a.dutyPreset)],
                              )}
                            />
                            <span className="truncate text-[9px] font-medium leading-tight text-zinc-700">
                              {displayName}
                            </span>
                          </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ── Desktop: expanded date header ── */}
                    <div className="hidden md:flex items-center justify-between gap-2">
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
                        {visibleAssignments.length}
                        {visibleAssignments.length === 1 ? " duty" : " duties"}
                      </span>
                    </div>

                    {/* ── Desktop: full assignment cards ── */}
                    <div className="hidden md:grid gap-2">
                      {visibleAssignments.length ? (
                        visibleAssignments.map((assignment) => {
                          const displayName = getDutyAssignmentDisplayName(
                            assignment,
                            personnelByKey,
                          );

                          return (
                          <DutyAssignmentButton
                            key={assignment._id}
                            assignment={assignment}
                            displayName={displayName}
                            canManageAssignments={canManageAssignments}
                            onClick={() => openEditDialog(assignment)}
                          />
                          );
                        })
                      ) : (
                        <div className="rounded-xl border border-dashed border-border px-3 py-4 text-[14px] h-10 text-muted-foreground">
                          NIL
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {canManageAssignments ? (
        <DutyAssignmentDialog
          key={`${selectedAssignment?._id ?? selectedDate}-${isDialogOpen ? "open" : "closed"}`}
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);

            if (!open) {
              setSelectedAssignment(null);
              const savedPosition = scrollPositionRef.current;
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  window.scrollTo(0, savedPosition);
                });
              });
            }
          }}
          assignment={selectedAssignment}
          initialDate={selectedDate}
          personnel={personnel}
        />
      ) : null}
    </>
  );
}
