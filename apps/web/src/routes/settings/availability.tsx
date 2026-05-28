import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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

export function SettingsAvailabilityRoute() {
  const [searchParams] = useSearchParams();
  const employeeId = searchParams.get("employeeId");
  const {
    handleSubmit,
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
        ...day,
        dayOfWeek: weekDays[index]?.value,
      }))
      .filter((day) => day.enabled);

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
    <section className="mx-auto w-[720px] max-w-full">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-medium tracking-tight">Availability</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure working hours for shifts and schedule planning.
          </p>
        </div>

        <form
          className="rounded-xl bg-card text-sm"
          onSubmit={handleSubmit(onSubmit)}
        >
          {employeeId && (
            <>
              <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <div>
                  <p className="font-medium">Employee</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Availability is being edited for this employee record.
                  </p>
                </div>
                <Input
                  className="w-full sm:w-[280px]"
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
                    className="grid min-h-[92px] grid-cols-[72px_1fr_auto] items-center gap-3 px-4 py-4 sm:grid-cols-[88px_1fr_auto]"
                    key={day.value}
                  >
                    <p className="font-semibold text-foreground">
                      {day.label}
                    </p>

                    {enabled ? (
                      <div className="grid max-w-[400px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                        <Input
                          aria-label={`${day.name} start time`}
                          className="h-12 rounded-xl text-base sm:text-sm"
                          type="time"
                          {...register(`days.${index}.startTime`, {
                            validate: (value, values) =>
                              !values.days[index]?.enabled ||
                              value < values.days[index].endTime ||
                              "Start time must be before end time",
                          })}
                        />
                        <span className="text-muted-foreground">-</span>
                        <Input
                          aria-label={`${day.name} end time`}
                          className="h-12 rounded-xl text-base sm:text-sm"
                          type="time"
                          {...register(`days.${index}.endTime`, {
                            validate: (value, values) =>
                              !values.days[index]?.enabled ||
                              values.days[index].startTime < value ||
                              "End time must be after start time",
                            })}
                        />
                      </div>
                    ) : (
                      <p className="text-base text-foreground">Unavailable</p>
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
                          <IconTrash className="size-5" />
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
                          <IconPlus className="size-5" />
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

          <div className="flex justify-end px-5 py-4">
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save availability"}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
