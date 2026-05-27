CREATE TABLE "employee_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"timezone" text NOT NULL,
	"effective_from" date,
	"effective_until" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_availability_day_of_week_check" CHECK ("employee_availability"."day_of_week" between 0 and 6),
	CONSTRAINT "employee_availability_time_range_check" CHECK ("employee_availability"."start_time" < "employee_availability"."end_time"),
	CONSTRAINT "employee_availability_effective_range_check" CHECK ("employee_availability"."effective_until" is null or "employee_availability"."effective_from" is null or "employee_availability"."effective_from" <= "employee_availability"."effective_until")
);
--> statement-breakpoint
ALTER TABLE "employee_availability" ADD CONSTRAINT "employee_availability_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "employee_availability_employee_id_idx" ON "employee_availability" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_availability_unique_window_idx" ON "employee_availability" USING btree ("employee_id","day_of_week","start_time","end_time");