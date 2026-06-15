import { sql } from "drizzle-orm"
import { bigint, boolean, check, date, index, integer, jsonb, pgEnum, pgTable, text, time, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"

export const organizations = pgTable("organizations", {
  id: uuid("id")
    .defaultRandom()
    .primaryKey(),
  name: text("name")
    .notNull()
    .unique(),
  slug: text("slug")
    .notNull()
    .unique(),
  logoUrl: text("logo_url"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const customers = pgTable("customers", {
  // What organization does this customer belong to?
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  // Stripe Customer ID from Stripe, e.g. cus_1234.
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
})

export const products = pgTable("products", {
  // Product ID from Stripe, e.g. prod_1234.
  id: text("id").primaryKey(),
  // Whether the product is active.
  active: boolean("active").notNull().default(true),
  // Product name.
  name: text("name").notNull(),
  // Product description.
  description: text("description"),
  // Product image URL.
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const pricingType = pgEnum("pricing_type", ["recurring"])
export const pricingPlanInterval = pgEnum("pricing_plan_interval", ["month", "year"])
export const subscriptionStatus = pgEnum("subscription_status", [
  "trialing",
  "active",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "past_due",
  "unpaid",
  "paused",
])

/**
 * PRICES
 * Note: prices are created and managed in Stripe and synced to our DB via Stripe webhooks.
 */
export const prices = pgTable(
  "prices",
  {
    // Price ID from Stripe, e.g. price_1234.
    id: text("id").primaryKey(),
    // The ID of the product that this price belongs to.
    productId: text("product_id").notNull().references(() => products.id),
    // Whether the price can be used for new purchases.
    active: boolean("active").notNull().default(true),
    // A brief description of the price.
    description: text("description"),
    // The unit amount as a positive integer in the smallest currency unit (e.g., 100 cents for US$1.00 or 100 for ¥100, a zero-decimal currency).
    unitAmount: bigint("unit_amount", { mode: "number" }).notNull(),
    // Three-letter ISO currency code, in lowercase.
    currency: text("currency").notNull().default("usd"),
    // Recurring because Cron only supports subscription purchases.
    type: pricingType("type").notNull().default("recurring"),
    // The frequency at which a subscription is billed. Cron supports month or year.
    interval: pricingPlanInterval("interval").notNull(),
    // The number of intervals (specified in the `interval` attribute) between subscription billings. For example, `interval=month` and `interval_count=3` bills every 3 months.
    intervalCount: integer("interval_count").notNull().default(1),
    // Default number of trial days when subscribing a customer to this price using [`trial_from_plan=true`](https://stripe.com/docs/api#create_subscription-trial_from_plan).
    trialPeriodDays: integer("trial_period_days"),
    // Set of key-value pairs, used to store additional information about the object in a structured format.
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("prices_unit_amount_positive_check", sql`${table.unitAmount} > 0`),
    check("prices_currency_length_check", sql`char_length(${table.currency}) = 3`),
  ],
)

export const subscriptions = pgTable("subscriptions", {
  // Subscription ID from Stripe, e.g. sub_1234.
  id: text("id").primaryKey(),
  // The Stripe customer that owns this subscription.
  customerId: text("customer_id").notNull().references(() => customers.stripeCustomerId),
  // The status of the subscription object, one of subscription_status type above.
  status: subscriptionStatus("status").notNull(),
  // Set of key-value pairs, used to store additional information about the object in a structured format.
  metadata: jsonb("metadata"),
  // ID of the price that created this subscription.
  priceId: text("price_id").references(() => prices.id),
  // Quantity multiplied by the unit amount of the price creates the amount of the subscription. Can be used to charge multiple seats.
  quantity: integer("quantity"),
  // If true the subscription has been canceled by the user and will be deleted at the end of the billing period.
  cancelAtPeriodEnd: boolean("cancel_at_period_end"),
  // Time at which the subscription was created.
  createdAt: timestamp("created", { withTimezone: true }).notNull().defaultNow(),
  // Start of the current period that the subscription has been invoiced for.
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull().defaultNow(),
  // End of the current period that the subscription has been invoiced for. At the end of this period, a new invoice will be created.
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull().defaultNow(),
  // If the subscription has ended, the timestamp of the date the subscription ended.
  endedAt: timestamp("ended_at", { withTimezone: true }).defaultNow(),
  // A date in the future at which the subscription will automatically get canceled.
  cancelAt: timestamp("cancel_at", { withTimezone: true }).defaultNow(),
  // If the subscription has been canceled, the date of that cancellation. If the subscription was canceled with `cancel_at_period_end`, `canceled_at` will still reflect the date of the initial cancellation request, not the end of the subscription period when the subscription is automatically moved to a canceled state.
  canceledAt: timestamp("canceled_at", { withTimezone: true }).defaultNow(),
  // If the subscription has a trial, the beginning of that trial.
  trialStart: timestamp("trial_start", { withTimezone: true }).defaultNow(),
  // If the subscription has a trial, the end of that trial.
  trialEnd: timestamp("trial_end", { withTimezone: true }).defaultNow(),
})

export const locations = pgTable("locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const departments = pgTable("departments", {
  id: uuid("id").defaultRandom().primaryKey(),
  locationId: uuid("location_id")
    .notNull()
    .references(() => locations.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const employees = pgTable("employees", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").unique(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  locationId: uuid("location_id").references(() => locations.id),
  departmentId: uuid("department_id").references(() => departments.id),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  jobTitle: text("job_title"),
  role: text("role").notNull().default("employee"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const invitations = pgTable("invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  locationId: uuid("location_id").references(() => locations.id),
  departmentId: uuid("department_id").references(() => departments.id),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("member"),
  invitedBy: uuid("invited_by").references(() => employees.id),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const managerScopes = pgTable("manager_scopes", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id),
  scopeType: text("scope_type").notNull(), // 'location' | 'department'
  scopeId: uuid("scope_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const employeeAvailability = pgTable(
  "employee_availability",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    dayOfWeek: integer("day_of_week").notNull(), // 0 = Sunday, 6 = Saturday
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    timezone: text("timezone").notNull(),
    effectiveFrom: date("effective_from"),
    effectiveUntil: date("effective_until"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("employee_availability_employee_id_idx").on(table.employeeId),
    uniqueIndex("employee_availability_unique_window_idx").on(
      table.employeeId,
      table.dayOfWeek,
      table.startTime,
      table.endTime,
    ),
    check("employee_availability_day_of_week_check", sql`${table.dayOfWeek} between 0 and 6`),
    check("employee_availability_time_range_check", sql`${table.startTime} < ${table.endTime}`),
    check(
      "employee_availability_effective_range_check",
      sql`${table.effectiveUntil} is null or ${table.effectiveFrom} is null or ${table.effectiveFrom} <= ${table.effectiveUntil}`,
    ),
  ],
)
