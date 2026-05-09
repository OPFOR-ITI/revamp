"use client";

import { ChevronsUpDown } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  formatTimeHHmmLabel,
  getTimeOptions,
  isValidTimeHHmm,
  isValidTimeSlot,
} from "@/lib/date";
import { useState } from "react";

type TimePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  minTime: string;
  maxTime: string;
  minuteStep: number;
  placeholder?: string;
};

function getHoursFromOptions(options: string[]) {
  return Array.from(new Set(options.map((option) => option.slice(0, 2))));
}

function getMinutesForHour(options: string[], hour: string) {
  return options
    .filter((option) => option.startsWith(hour))
    .map((option) => option.slice(2, 4));
}

export function TimePicker({
  id,
  value,
  onChange,
  minTime,
  maxTime,
  minuteStep,
  placeholder = "Select time",
}: TimePickerProps) {
  const [open, setOpen] = useState(false);

  const timeOptions = getTimeOptions({ minTime, maxTime, minuteStep });
  const hourOptions = getHoursFromOptions(timeOptions);
  const fallbackTime = timeOptions[0] ?? "";

  const selectedValue = isValidTimeSlot({
    value,
    minTime,
    maxTime,
    minuteStep,
  })
    ? value
    : fallbackTime;

  const selectedHour = selectedValue.slice(0, 2);
  const selectedMinute = selectedValue.slice(2, 4);
  const minuteOptions = getMinutesForHour(timeOptions, selectedHour);

  function handleHourChange(hour: string) {
    const nextValue = `${hour}${selectedMinute}`;

    if (
      isValidTimeSlot({
        value: nextValue,
        minTime,
        maxTime,
        minuteStep,
      })
    ) {
      onChange(nextValue);
      return;
    }

    const firstMinute = getMinutesForHour(timeOptions, hour)[0];

    if (firstMinute) {
      onChange(`${hour}${firstMinute}`);
    }
  }

  function handleMinuteChange(minute: string) {
    onChange(`${selectedHour}${minute}`);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        className={`${buttonVariants({ variant: "outline" })} h-10 w-full justify-between rounded-lg border border-zinc-200 px-3 font-normal ${
          isValidTimeHHmm(value) ? "text-zinc-900" : "text-muted-foreground"
        }`}
      >
        <span>
          {isValidTimeHHmm(value) ? formatTimeHHmmLabel(value) : placeholder}
        </span>
        <ChevronsUpDown className="size-4 text-muted-foreground" />
      </PopoverTrigger>

      <PopoverContent align="start" className="w-36 p-0">
        <div className="grid h-64 grid-cols-2 overflow-hidden rounded-lg bg-background">
          <div className="scrollbar-hidden overflow-y-auto py-2">
            {hourOptions.map((hour) => {
              const isSelected = selectedHour === hour;

              return (
                <button
                  key={hour}
                  type="button"
                  onClick={() => handleHourChange(hour)}
                  className={`flex h-9 w-full items-center justify-center text-sm transition-colors hover:bg-muted ${
                    isSelected
                      ? "bg-muted font-medium text-zinc-950"
                      : "text-zinc-700"
                  }`}
                >
                  {hour}
                </button>
              );
            })}
          </div>

          <div className="scrollbar-hidden overflow-y-auto border-l border-border py-2">
            {minuteOptions.map((minute) => {
              const isSelected = selectedMinute === minute;

              return (
                <button
                  key={minute}
                  type="button"
                  onClick={() => handleMinuteChange(minute)}
                  className={`flex h-9 w-full items-center justify-center text-sm transition-colors hover:bg-muted ${
                    isSelected
                      ? "bg-muted font-medium text-zinc-950"
                      : "text-zinc-700"
                  }`}
                >
                  {minute}
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}