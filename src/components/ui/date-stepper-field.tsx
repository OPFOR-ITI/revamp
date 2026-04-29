"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";

import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  addDaysToDateString,
  dateStringToDayIndex,
  formatDateLabel,
} from "@/lib/date";
import { cn } from "@/lib/utils";

function isBeforeMinDate(value: string, minDate?: string) {
  return minDate
    ? dateStringToDayIndex(value) < dateStringToDayIndex(minDate)
    : false;
}

function isAfterMaxDate(value: string, maxDate?: string) {
  return maxDate
    ? dateStringToDayIndex(value) > dateStringToDayIndex(maxDate)
    : false;
}

export function DateStepperField({
  id,
  label,
  value,
  onChange,
  error,
  minDate,
  maxDate,
  description,
  placeholder = "Select date",
  disabled = false,
  className,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  minDate?: string;
  maxDate?: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const selectedDate = value ? parseISO(value) : undefined;

  function handleStep(amount: number) {
    if (!value) {
      return;
    }

    const nextValue = addDaysToDateString(value, amount);

    if (isBeforeMinDate(nextValue, minDate) || isAfterMaxDate(nextValue, maxDate)) {
      return;
    }

    onChange(nextValue);
  }

  const backDisabled =
    disabled || !value || isBeforeMinDate(addDaysToDateString(value, -1), minDate);
  const forwardDisabled =
    disabled || !value || isAfterMaxDate(addDaysToDateString(value, 1), maxDate);

  return (
    <FormItem className={className}>
      <FormLabel htmlFor={id}>{label}</FormLabel>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="shrink-0"
          aria-label={`Move ${label} back by one day`}
          onClick={() => handleStep(-1)}
          disabled={backDisabled}
        >
          <ChevronLeft className="size-4" />
        </Button>

        <Popover>
          <PopoverTrigger
            id={id}
            disabled={disabled}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-10 min-w-0 flex-1 justify-between px-3 text-left font-normal",
              !value && "text-muted-foreground",
            )}
          >
            <span className="truncate">
              {value ? formatDateLabel(value) : placeholder}
            </span>
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
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
                  isBeforeMinDate(nextValue, minDate) ||
                  isAfterMaxDate(nextValue, maxDate)
                );
              }}
            />
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="shrink-0"
          aria-label={`Move ${label} forward by one day`}
          onClick={() => handleStep(1)}
          disabled={forwardDisabled}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      {description ? <FormDescription>{description}</FormDescription> : null}
      <FormMessage>{error}</FormMessage>
    </FormItem>
  );
}
