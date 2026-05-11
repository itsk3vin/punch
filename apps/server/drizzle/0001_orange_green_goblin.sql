ALTER TABLE "invitations" ADD COLUMN "name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "name" DROP DEFAULT;