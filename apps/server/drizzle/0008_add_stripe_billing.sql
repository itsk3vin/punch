ALTER TABLE "organizations" ADD COLUMN "stripe_customer_id" text;
ALTER TABLE "organizations" ADD COLUMN "stripe_subscription_id" text;
ALTER TABLE "organizations" ADD COLUMN "stripe_subscription_status" text;
ALTER TABLE "organizations" ADD COLUMN "stripe_price_id" text;
ALTER TABLE "organizations" ADD COLUMN "billing_quantity" integer;
ALTER TABLE "organizations" ADD COLUMN "billing_current_period_end" timestamp with time zone;
