CREATE TYPE "public"."pricing_plan_interval" AS ENUM('month', 'year');--> statement-breakpoint
CREATE TYPE "public"."pricing_type" AS ENUM('recurring');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid', 'paused');--> statement-breakpoint
CREATE TABLE "customers" (
	"organization_id" uuid NOT NULL,
	"stripe_customer_id" text NOT NULL,
	CONSTRAINT "customers_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"description" text,
	"unit_amount" bigint NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"type" "pricing_type" DEFAULT 'recurring' NOT NULL,
	"interval" "pricing_plan_interval" NOT NULL,
	"interval_count" integer DEFAULT 1 NOT NULL,
	"trial_period_days" integer,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prices_unit_amount_positive_check" CHECK ("prices"."unit_amount" > 0),
	CONSTRAINT "prices_currency_length_check" CHECK (char_length("prices"."currency") = 3)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"status" "subscription_status" NOT NULL,
	"metadata" jsonb,
	"price_id" text,
	"quantity" integer,
	"cancel_at_period_end" boolean,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"current_period_start" timestamp with time zone DEFAULT now() NOT NULL,
	"current_period_end" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone DEFAULT now(),
	"cancel_at" timestamp with time zone DEFAULT now(),
	"canceled_at" timestamp with time zone DEFAULT now(),
	"trial_start" timestamp with time zone DEFAULT now(),
	"trial_end" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "employees" ALTER COLUMN "name" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_customer_id_customers_stripe_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("stripe_customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_price_id_prices_id_fk" FOREIGN KEY ("price_id") REFERENCES "public"."prices"("id") ON DELETE no action ON UPDATE no action;