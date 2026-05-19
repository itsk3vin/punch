ALTER TABLE "locations" ADD COLUMN "address" text NOT NULL DEFAULT '';
ALTER TABLE "locations" ALTER COLUMN "address" DROP DEFAULT;
