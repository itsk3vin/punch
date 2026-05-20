import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { PgDrizzle } from "@effect/sql-drizzle/Pg";
import * as tables from "../src/db/schema";
import * as SqlLive from "../src/db/SqlLive";

const SEED_ORG_SLUG = "cron";

const seed = Effect.gen(function* () {
  const db = yield* PgDrizzle;

  const [existing] = yield* db
    .select()
    .from(tables.organizations)
    .where(eq(tables.organizations.slug, SEED_ORG_SLUG))
    .limit(1);

  if (existing) {
    const orgId = existing.id;

    const orgEmployees = yield* db
      .select({ id: tables.employees.id })
      .from(tables.employees)
      .where(eq(tables.employees.organizationId, orgId));

    const employeeIds = orgEmployees.map((employee) => employee.id);

    if (employeeIds.length > 0) {
      yield* db
        .delete(tables.managerScopes)
        .where(inArray(tables.managerScopes.employeeId, employeeIds));
    }

    yield* db
      .delete(tables.invitations)
      .where(eq(tables.invitations.organizationId, orgId));

    yield* db
      .delete(tables.employees)
      .where(eq(tables.employees.organizationId, orgId));

    const orgLocations = yield* db
      .select({ id: tables.locations.id })
      .from(tables.locations)
      .where(eq(tables.locations.organizationId, orgId));

    const locationIds = orgLocations.map((location) => location.id);

    if (locationIds.length > 0) {
      yield* db
        .delete(tables.departments)
        .where(inArray(tables.departments.locationId, locationIds));

      yield* db
        .delete(tables.locations)
        .where(eq(tables.locations.organizationId, orgId));
    }

    yield* db
      .delete(tables.organizations)
      .where(eq(tables.organizations.id, orgId));
  }

  const organizationData: typeof tables.organizations.$inferInsert = {
    name: "Cron",
    slug: SEED_ORG_SLUG,
    logoUrl: null,
  };

  const [organization] = yield* db
    .insert(tables.organizations)
    .values(organizationData)
    .returning();

  if (!organization) {
    throw new Error("Failed to create organization");
  }

  const locationData: (typeof tables.locations.$inferInsert)[] = [
    {
      organizationId: organization.id,
      name: "Winterfell",
      address: "1 Godswood Road",
      city: "Winterfell",
      state: "The North",
    },
    {
      organizationId: organization.id,
      name: "King's Landing",
      address: "1 Red Keep Plaza",
      city: "King's Landing",
      state: "Crownlands",
    },
    {
      organizationId: organization.id,
      name: "Dragonstone",
      address: "1 Painted Table Way",
      city: "Dragonstone",
      state: "Crownlands",
    },
  ];

  const locations = yield* db
    .insert(tables.locations)
    .values(locationData)
    .returning();

  const winterfell = locations.find(
    (location) => location.name === "Winterfell",
  );
  const kingsLanding = locations.find(
    (location) => location.name === "King's Landing",
  );
  const dragonstone = locations.find(
    (location) => location.name === "Dragonstone",
  );

  if (!winterfell || !kingsLanding || !dragonstone) {
    throw new Error("Failed to create locations");
  }

  const departmentData: (typeof tables.departments.$inferInsert)[] = [
    {
      locationId: winterfell.id,
      name: "Winterfell Operations",
    },
    {
      locationId: winterfell.id,
      name: "Winterfell Engineering",
    },
    {
      locationId: kingsLanding.id,
      name: "King's Landing Finance",
    },
    {
      locationId: kingsLanding.id,
      name: "King's Landing People",
    },
    {
      locationId: kingsLanding.id,
      name: "King's Landing Operations",
    },
    {
      locationId: dragonstone.id,
      name: "Dragonstone Product",
    },
    {
      locationId: dragonstone.id,
      name: "Dragonstone Operations",
    },
  ];

  const departments = yield* db
    .insert(tables.departments)
    .values(departmentData)
    .returning();

  const winterfellOperations = departments.find(
    (department) => department.name === "Winterfell Operations",
  );
  const winterfellEngineering = departments.find(
    (department) => department.name === "Winterfell Engineering",
  );
  const kingsLandingFinance = departments.find(
    (department) => department.name === "King's Landing Finance",
  );
  const kingsLandingPeople = departments.find(
    (department) => department.name === "King's Landing People",
  );
  const kingsLandingOperations = departments.find(
    (department) => department.name === "King's Landing Operations",
  );
  const dragonstoneProduct = departments.find(
    (department) => department.name === "Dragonstone Product",
  );
  const dragonstoneOperations = departments.find(
    (department) => department.name === "Dragonstone Operations",
  );

  if (
    !winterfellOperations ||
    !winterfellEngineering ||
    !kingsLandingFinance ||
    !kingsLandingPeople ||
    !kingsLandingOperations ||
    !dragonstoneProduct ||
    !dragonstoneOperations
  ) {
    throw new Error("Failed to create departments");
  }

  const members: (typeof tables.employees.$inferInsert)[] = [
    {
      email: "ned.stark@example.com",
      name: "Ned Stark",
      role: "admin",
      organizationId: organization.id,
      locationId: winterfell.id,
      departmentId: winterfellOperations.id,
    },
    {
      email: "catelyn.stark@example.com",
      name: "Catelyn Stark",
      role: "manager",
      organizationId: organization.id,
      locationId: winterfell.id,
      departmentId: winterfellOperations.id,
    },
    {
      email: "jon.snow@example.com",
      name: "Jon Snow",
      role: "manager",
      organizationId: organization.id,
      locationId: winterfell.id,
      departmentId: winterfellOperations.id,
    },
    {
      email: "arya.stark@example.com",
      name: "Arya Stark",
      role: "employee",
      organizationId: organization.id,
      locationId: winterfell.id,
      departmentId: winterfellEngineering.id,
    },
    {
      email: "sansa.stark@example.com",
      name: "Sansa Stark",
      role: "manager",
      organizationId: organization.id,
      locationId: kingsLanding.id,
      departmentId: kingsLandingPeople.id,
    },
    {
      email: "tyrion.lannister@example.com",
      name: "Tyrion Lannister",
      role: "manager",
      organizationId: organization.id,
      locationId: kingsLanding.id,
      departmentId: kingsLandingFinance.id,
    },
    {
      email: "cersei.lannister@example.com",
      name: "Cersei Lannister",
      role: "admin",
      organizationId: organization.id,
      locationId: kingsLanding.id,
      departmentId: kingsLandingFinance.id,
    },
    {
      email: "jaime.lannister@example.com",
      name: "Jaime Lannister",
      role: "employee",
      organizationId: organization.id,
      locationId: kingsLanding.id,
      departmentId: kingsLandingOperations.id,
    },
    {
      email: "daenerys.targaryen@example.com",
      name: "Daenerys Targaryen",
      role: "admin",
      organizationId: organization.id,
      locationId: dragonstone.id,
      departmentId: dragonstoneProduct.id,
    },
    {
      email: "jorah.mormont@example.com",
      name: "Jorah Mormont",
      role: "employee",
      organizationId: organization.id,
      locationId: dragonstone.id,
      departmentId: dragonstoneOperations.id,
    },
    {
      email: "brienne.tarth@example.com",
      name: "Brienne of Tarth",
      role: "manager",
      organizationId: organization.id,
      locationId: kingsLanding.id,
      departmentId: kingsLandingOperations.id,
    },
    {
      email: "samwell.tarly@example.com",
      name: "Samwell Tarly",
      role: "employee",
      organizationId: organization.id,
      locationId: winterfell.id,
      departmentId: winterfellEngineering.id,
    },
  ];

  const employees = yield* db
    .insert(tables.employees)
    .values(members)
    .returning();

  const jonSnow = employees.find(
    (employee) => employee.email === "jon.snow@example.com",
  );
  const sansaStark = employees.find(
    (employee) => employee.email === "sansa.stark@example.com",
  );
  const tyrionLannister = employees.find(
    (employee) => employee.email === "tyrion.lannister@example.com",
  );
  const brienneTarth = employees.find(
    (employee) => employee.email === "brienne.tarth@example.com",
  );

  if (!jonSnow || !sansaStark || !tyrionLannister || !brienneTarth) {
    throw new Error("Failed to create manager employees");
  }

  const managerScopes: (typeof tables.managerScopes.$inferInsert)[] = [
    {
      employeeId: jonSnow.id,
      scopeType: "location",
      scopeId: winterfell.id,
    },
    {
      employeeId: sansaStark.id,
      scopeType: "department",
      scopeId: kingsLandingPeople.id,
    },
    {
      employeeId: tyrionLannister.id,
      scopeType: "location",
      scopeId: kingsLanding.id,
    },
    {
      employeeId: brienneTarth.id,
      scopeType: "department",
      scopeId: kingsLandingOperations.id,
    },
  ];

  yield* db.insert(tables.managerScopes).values(managerScopes);
});

const program = seed.pipe(Effect.provide(SqlLive.layer));

Effect.runPromise(program)
  .then(() => {
    console.log("Seed complete.");
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
