"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";

import { api } from "../../../convex/_generated/api";
import type { ConductListItem } from "@/components/conducts/types";
import { Button } from "@/components/ui/button";
import { DateStepperField } from "@/components/ui/date-stepper-field";
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
import { Textarea } from "@/components/ui/textarea";

const conductFormSchema = z.object({
  name: z.string().trim().min(1, "Conduct name is required."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use "YYYY-MM-DD".'),
  numberOfPeriods: z.number().int().min(1, "At least 1 period is required."),
  description: z.string().optional(),
});

type ConductFormValues = z.infer<typeof conductFormSchema>;

function getDefaultValues(date: string): ConductFormValues {
  return {
    name: "",
    date,
    numberOfPeriods: 1,
    description: "",
  };
}

function getValuesFromConduct(conduct: ConductListItem): ConductFormValues {
  return {
    name: conduct.name,
    date: conduct.date,
    numberOfPeriods: conduct.numberOfPeriods,
    description: conduct.description ?? "",
  };
}

export function ConductFormDialog({
  open,
  onOpenChange,
  mode,
  initialDate,
  conduct,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialDate: string;
  conduct: ConductListItem | null;
}) {
  const createConduct = useMutation(api.conducts.createConduct);
  const updateConduct = useMutation(api.conducts.updateConduct);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<ConductFormValues>({
    resolver: zodResolver(conductFormSchema),
    defaultValues: getDefaultValues(initialDate),
  });

  useEffect(() => {
    if (!open) {
      form.reset(getDefaultValues(initialDate));
      return;
    }

    if (mode === "edit" && conduct) {
      form.reset(getValuesFromConduct(conduct));
      return;
    }

    form.reset(getDefaultValues(initialDate));
  }, [conduct, form, initialDate, mode, open]);

  const dateLocked = mode === "edit" && conduct?.hasAttendance;

  async function onSubmit(values: ConductFormValues) {
    setIsSubmitting(true);

    try {
      if (mode === "edit" && conduct) {
        await updateConduct({
          conductId: conduct._id,
          name: values.name,
          date: values.date,
          numberOfPeriods: values.numberOfPeriods,
          description: values.description?.trim() || undefined,
        });
        toast.success("Conduct updated.");
      } else {
        await createConduct({
          name: values.name,
          date: values.date,
          numberOfPeriods: values.numberOfPeriods,
          description: values.description?.trim() || undefined,
        });
        toast.success("Conduct created.");
      }

      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : mode === "edit"
            ? "Unable to update conduct."
            : "Unable to create conduct.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-1rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit Conduct" : "Create Conduct"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Update the conduct details. Attendance is managed separately."
              : "Create a conduct, then mark who missed it."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
            <FormItem>
              <FormLabel htmlFor="conduct-name">Conduct Name</FormLabel>
              <Input
                id="conduct-name"
                value={form.watch("name")}
                onChange={(event) =>
                  form.setValue("name", event.target.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                placeholder="Combat circuit, route march, IPPT..."
                className="h-10"
              />
              <FormMessage>{form.formState.errors.name?.message}</FormMessage>
            </FormItem>

            <DateStepperField
              label="Conduct Date"
              value={form.watch("date")}
              onChange={(value) =>
                form.setValue("date", value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              error={form.formState.errors.date?.message}
              description={
                dateLocked
                  ? "The date is locked after attendance has been initialized for this conduct."
                  : undefined
              }
              disabled={dateLocked}
            />

            <FormItem>
              <FormLabel htmlFor="conduct-periods">Number of Periods</FormLabel>
              <Input
                id="conduct-periods"
                type="number"
                min={1}
                step={1}
                value={String(form.watch("numberOfPeriods") ?? 1)}
                onChange={(event) =>
                  form.setValue("numberOfPeriods", Number(event.target.value || 1), {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                className="h-10"
              />
              <FormDescription>
                Informational only. Attendance is still tracked once per conduct.
              </FormDescription>
              <FormMessage>
                {form.formState.errors.numberOfPeriods?.message}
              </FormMessage>
            </FormItem>

            <FormItem>
              <FormLabel htmlFor="conduct-description">Description</FormLabel>
              <Textarea
                id="conduct-description"
                value={form.watch("description") ?? ""}
                onChange={(event) =>
                  form.setValue("description", event.target.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                placeholder="Optional notes for the operators."
              />
              <FormMessage>{form.formState.errors.description?.message}</FormMessage>
            </FormItem>

            <DialogFooter className="gap-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="min-w-28"
              >
                {isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {mode === "edit" ? "Save Changes" : "Create Conduct"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
