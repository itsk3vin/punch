DELETE FROM "manager_scopes" WHERE "scope_type" = 'location_group';--> statement-breakpoint
DROP TABLE IF EXISTS "location_group_locations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "location_groups" CASCADE;