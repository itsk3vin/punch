import { IconPlus, IconTrash } from "@tabler/icons-react";
import { Controller, useForm } from "react-hook-form";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

const weekDays = [
  { label: "Mon.", name: "Monday", value: 1 },
  { label: "Tue.", name: "Tuesday", value: 2 },
  { label: "Wed.", name: "Wednesday", value: 3 },
  { label: "Thu.", name: "Thursday", value: 4 },
  { label: "Fri.", name: "Friday", value: 5 },
  { label: "Sat.", name: "Saturday", value: 6 },
  { label: "Sun.", name: "Sunday", value: 0 },
] as const;

const timeOptions = createTimeOptions();
type TimeOption = (typeof timeOptions)[number];

type AvailabilityDay = {
  enabled: boolean;
  startTime: string;
  endTime: string;
};

type AvailabilityFormValues = {
  days: AvailabilityDay[];
};

const defaultAvailability = weekDays.map(({ value }) => ({
  enabled: value > 0 && value < 6,
  startTime: "09:00",
  endTime: "17:00",
}));

function createTimeOptions() {
  const options = [];

  for (let totalMinutes = 0; totalMinutes <= 23 * 60 + 30; totalMinutes += 30) {
    options.push({
      label: formatTimeLabel(totalMinutes),
      value: formatTimeValue(totalMinutes),
    });
  }

  options.push({ label: "11:59pm", value: "23:59" });

  return options;
}

function TimeCombobox({
  ariaLabel,
  onValueChange,
  value,
}: {
  ariaLabel: string;
  onValueChange: (value: string) => void;
  value: string;
}) {
  const selectedOption =
    timeOptions.find((option) => option.value === value) ?? null;

  return (
    <Combobox
      itemToStringLabel={(option: TimeOption) => option.label}
      itemToStringValue={(option: TimeOption) => option.value}
      onValueChange={(option: TimeOption | null) => {
        if (option) {
          onValueChange(option.value);
        }
      }}
      value={selectedOption}
    >
      <ComboboxInput
        aria-label={ariaLabel}
        className="w-full [&_[data-slot=input-group]]:h-12 [&_[data-slot=input-group]]:rounded-xl [&_[data-slot=input-group]]:bg-background [&_[data-slot=input-group]]:shadow-sm"
        inputClassName="px-4 text-base outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
      />
      <ComboboxContent className="min-w-[200px] rounded-xl p-2 shadow-xl">
        <ComboboxEmpty>No times found.</ComboboxEmpty>
        <ComboboxList className="max-h-[368px] p-0">
          {timeOptions.map((option) => (
            <ComboboxItem
              className="rounded-xl px-4 py-3 text-base data-highlighted:bg-muted"
              key={option.value}
              value={option}
            >
              {option.label}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

function formatTimeLabel(totalMinutes: number) {
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const period = hours24 >= 12 ? "pm" : "am";
  const hours12 = hours24 % 12 || 12;

  return `${hours12}:${minutes.toString().padStart(2, "0")}${period}`;
}

function formatTimeValue(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}

export function SettingsAvailabilityRoute() {
  const [searchParams] = useSearchParams();
  const employeeId = searchParams.get("employeeId");
  const {
    handleSubmit,
    control,
    register,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AvailabilityFormValues>({
    defaultValues: {
      days: defaultAvailability,
    },
  });
  const days = watch("days");

  function setDayAvailability(index: number, enabled: boolean) {
    setValue(`days.${index}.enabled`, enabled, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function onSubmit(values: AvailabilityFormValues) {
    const availableWindows = values.days
      .map((day, index) => ({
        dayOfWeek: weekDays[index]?.value,
        startTime: day.startTime,
        endTime: day.endTime,
      }))
      .filter((_, index) => values.days[index]?.enabled);

    if (availableWindows.length === 0) {
      toast.error("Choose at least one available day.");
      return;
    }

    toast.success("Availability ready to save.");
    console.info("Availability form values", {
      employeeId,
      availability: availableWindows,
    });
  }

  return (
    <section className="mx-auto w-[560px] max-w-full">
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-medium tracking-tight">Availability</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure working hours for shifts and schedule planning.
          </p>
        </div>

        <form className="bg-card text-sm" onSubmit={handleSubmit(onSubmit)}>
          {employeeId && (
            <>
              <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                <div>
                  <p className="font-medium">Employee</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Availability is being edited for this employee record.
                  </p>
                </div>
                <Input
                  className="h-9 w-full rounded-md sm:w-[260px]"
                  value={employeeId}
                  disabled
                />
              </div>
              <Separator />
            </>
          )}

          <div>
            <div className="divide-y bg-background">
              {weekDays.map((day, index) => {
                const enabled = days[index]?.enabled;

                return (
                  <div
                    className="grid min-h-[68px] grid-cols-[56px_1fr_36px] items-center gap-3 py-3 sm:grid-cols-[72px_1fr_36px]"
                    key={day.value}
                  >
                    <p className="text-sm font-semibold text-foreground">
                      {day.label}
                    </p>

                    {enabled ? (
                      <div className="grid max-w-[420px] grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)] items-center gap-4">
                        <Controller
                          control={control}
                          name={`days.${index}.startTime`}
                          rules={{
                            validate: (value, values) =>
                              !values.days[index]?.enabled ||
                              value < values.days[index].endTime ||
                              "Start time must be before end time",
                          }}
                          render={({ field }) => (
                            <TimeCombobox
                              ariaLabel={`${day.name} start time`}
                              onValueChange={field.onChange}
                              value={field.value}
                            />
                          )}
                        />
                        <span className="text-center text-lg text-foreground">
                          -
                        </span>
                        <Controller
                          control={control}
                          name={`days.${index}.endTime`}
                          rules={{
                            validate: (value, values) =>
                              !values.days[index]?.enabled ||
                              values.days[index].startTime < value ||
                              "End time must be after start time",
                          }}
                          render={({ field }) => (
                            <TimeCombobox
                              ariaLabel={`${day.name} end time`}
                              onValueChange={field.onChange}
                              value={field.value}
                            />
                          )}
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Unavailable
                      </p>
                    )}

                    <div className="flex items-center justify-end">
                      {enabled ? (
                        <Button
                          aria-label={`Remove ${day.name} availability`}
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => setDayAvailability(index, false)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <IconTrash className="size-4" />
                        </Button>
                      ) : (
                        <Button
                          aria-label={`Add ${day.name} availability`}
                          className="text-foreground"
                          onClick={() => setDayAvailability(index, true)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <IconPlus className="size-4" />
                        </Button>
                      )}
                    </div>

                    {(errors.days?.[index]?.startTime ||
                      errors.days?.[index]?.endTime) && (
                      <p className="col-span-full col-start-2 text-xs text-destructive">
                        {errors.days[index]?.startTime?.message ??
                          errors.days[index]?.endTime?.message}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          <div className="flex justify-end py-3">
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save availability"}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
