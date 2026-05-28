import { sql } from "drizzle-orm"
import { check, date, index, integer, pgTable, text, time, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"

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
