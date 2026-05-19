ALTER TABLE "locations" ADD COLUMN "city" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "state" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "locations" ALTER COLUMN "city" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "locations" ALTER COLUMN "state" DROP DEFAULT;
