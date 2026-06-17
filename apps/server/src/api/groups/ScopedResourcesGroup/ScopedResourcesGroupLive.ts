import { and, eq, inArray, sql } from "drizzle-orm";
import { HttpRouter, HttpServerRequest } from "@effect/platform";
import { Effect, Schema } from "effect";

import { syncSubscriptionQuantityForOrganization } from "../../billing.js";
import { db } from "../../db/index.js";
import {
  departments,
  employees,
  locations,
  managerScopes,
} from "../../db/schema.js";
import {
  handleAuthorizationError,
  requireDepartmentAccess,
  requireLocationAccess,
  requireManagerOrAdmin,
  requireOrganizationBillingAccess,
  requireOrganizationAccess,
  requireOrganizationAdmin,
} from "../middleware/organization.js";
import type { OrganizationalVisibility } from "../middleware/resourceScope.js";
import {
  departmentMatchesVisibility,
  getOrganizationalVisibility,
  rollupParentLocationsFromDepartmentScopes,
} from "../middleware/resourceScope.js";
import { json } from "../response.js";

const OrgParams = Schema.Struct({
  id: Schema.String,
});

const OrgLocationParams = Schema.Struct({
  id: Schema.String,
  locationId: Schema.String,
});

const OrgLocationNameParams = Schema.Struct({
  id: Schema.String,
  locationName: Schema.String,
});

const OrgDeptParams = Schema.Struct({
  id: Schema.String,
  departmentId: Schema.String,
});

const OrgEmpScopeParams = Schema.Struct({
  id: Schema.String,
  employeeId: Schema.String,
});

const OrgScopeRecordParams = Schema.Struct({
  id: Schema.String,
  recordId: Schema.String,
});

const ManagerScopeMutationBody = Schema.Struct({
  employeeId: Schema.String,
  scopeType: Schema.Union(
    Schema.Literal("location"),
    Schema.Literal("department"),
  ),
  scopeId: Schema.String,
});

const LocationCreateBody = Schema.Struct({
  name: Schema.String,
  address: Schema.String,
  city: Schema.String,
  state: Schema.String,
});

const LocationUpdateBody = Schema.Struct({
  name: Schema.String,
  address: Schema.String,
  city: Schema.String,
  state: Schema.String,
});

const DepartmentCreateBody = Schema.Struct({
  locationId: Schema.String,
  name: Schema.String,
});

const DepartmentUpdateBody = Schema.Struct({
  name: Schema.String,
});

const parseJsonBody = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  HttpServerRequest.schemaBodyJson(schema).pipe(
    Effect.mapError(() => new Error("invalid request body")),
  );

const enforceBillingAccess = (organizationId: string) =>
  requireOrganizationBillingAccess(organizationId).pipe(Effect.either);

async function assertScopeBelongsToOrganization(
  organizationId: string,
  scopeType: "location" | "department",
  scopeId: string,
): Promise<boolean> {
  if (scopeType === "location") {
    const rows = await db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.id, scopeId),
          eq(locations.organizationId, organizationId),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  const rows = await db
    .select({ departmentId: departments.id })
    .from(departments)
    .innerJoin(locations, eq(departments.locationId, locations.id))
    .where(
      and(
        eq(departments.id, scopeId),
        eq(locations.organizationId, organizationId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

const listLocations = Effect.gen(function* () {
  const { id: organizationId } = yield* HttpRouter.schemaPathParams(OrgParams);
  const authorized = yield* requireOrganizationAccess(organizationId).pipe(
    Effect.either,
  );
  if (authorized._tag === "Left") {
    return yield* handleAuthorizationError(authorized.left);
  }

  const viewer = authorized.right;
  const visibility = yield* Effect.tryPromise({
    try: () => getOrganizationalVisibility(viewer, organizationId),
    catch: () => new Error("failed to resolve visibility"),
  });

  let rows =
    visibility.kind === "all"
      ? yield* Effect.tryPromise({
          try: () =>
            db
              .select()
              .from(locations)
              .where(eq(locations.organizationId, organizationId)),
          catch: () => new Error("failed to list locations"),
        })
      : yield* Effect.tryPromise({
          try: async () => {
            const unionIds = [
              ...visibility.wholeBreadthLocationIds,
              ...(await rollupParentLocationsFromDepartmentScopes(visibility)),
            ];
            if (unionIds.length === 0) {
              return [] as (typeof locations.$inferSelect)[];
            }
            return db
              .select()
              .from(locations)
              .where(
                and(
                  eq(locations.organizationId, organizationId),
                  inArray(locations.id, [...new Set(unionIds)]),
                ),
              );
          },
          catch: () => new Error("failed to list locations"),
        });

  if (rows.length === 0) {
    return yield* json([]);
  }

  const locationIds = rows.map((r) => r.id);

  const { counts, managers } = yield* Effect.all({
    counts: Effect.tryPromise({
      try: () =>
        db
          .select({
            locationId: employees.locationId,
            count: sql<number>`count(*)::int`.as("count"),
          })
          .from(employees)
          .where(
            and(
              eq(employees.organizationId, organizationId),
              inArray(employees.locationId, locationIds),
            ),
          )
          .groupBy(employees.locationId),
      catch: () => new Error("failed to load employee counts"),
    }),
    managers: Effect.tryPromise({
      try: () =>
        db
          .select({
            locationId: managerScopes.scopeId,
            managerName: employees.name,
          })
          .from(managerScopes)
          .innerJoin(employees, eq(managerScopes.employeeId, employees.id))
          .where(
            and(
              eq(managerScopes.scopeType, "location"),
              inArray(managerScopes.scopeId, locationIds),
              eq(employees.organizationId, organizationId),
            ),
          ),
      catch: () => new Error("failed to load managers"),
    }),
  });

  const countById = new Map<string, number>(
    counts.map((c) => [c.locationId ?? "", c.count]),
  );
  const managersById = new Map<string, string[]>();
  for (const m of managers) {
    const list = managersById.get(m.locationId) ?? [];
    list.push(m.managerName);
    managersById.set(m.locationId, list);
  }

  const enriched = rows.map((loc) => ({
    ...loc,
    employeeCount: countById.get(loc.id) ?? 0,
    managers: managersById.get(loc.id) ?? [],
  }));

  enriched.sort((first, second) => first.name.localeCompare(second.name));
  return yield* json(enriched);
}).pipe(
  Effect.catchAll((error) =>
    error instanceof Error
      ? json({ error: error.message }, 400)
      : json({ error: "failed to list locations" }, 400),
  ),
);

const getLocationByName = Effect.gen(function* () {
  const { id: organizationId, locationName } =
    yield* HttpRouter.schemaPathParams(OrgLocationNameParams);
  const decodedLocationName = decodeURIComponent(locationName);

  const locationRows = yield* Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(locations)
        .where(
          and(
            eq(locations.organizationId, organizationId),
            eq(locations.name, decodedLocationName),
          ),
        )
        .limit(1),
    catch: () => new Error("failed to load location"),
  });

  const location = locationRows[0];
  if (!location) {
    return yield* json({ error: "location not found" }, 404);
  }

  const authorized = yield* requireLocationAccess(location.id).pipe(
    Effect.either,
  );
  if (authorized._tag === "Left") {
    return yield* handleAuthorizationError(authorized.left);
  }

  const { members, managers } = yield* Effect.all({
    members: Effect.tryPromise({
      try: () =>
        db
          .select({
            id: employees.id,
            name: employees.name,
            email: employees.email,
            role: employees.role,
            createdAt: employees.createdAt,
          })
          .from(employees)
          .where(
            and(
              eq(employees.organizationId, organizationId),
              eq(employees.locationId, location.id),
            ),
          ),
      catch: () => new Error("failed to load location members"),
    }),
    managers: Effect.tryPromise({
      try: () =>
        db
          .select({
            managerName: employees.name,
          })
          .from(managerScopes)
          .innerJoin(employees, eq(managerScopes.employeeId, employees.id))
          .where(
            and(
              eq(managerScopes.scopeType, "location"),
              eq(managerScopes.scopeId, location.id),
              eq(employees.organizationId, organizationId),
            ),
          ),
      catch: () => new Error("failed to load managers"),
    }),
  });

  const sortedMembers = [...members].sort((first, second) =>
    first.name.localeCompare(second.name),
  );

  return yield* json({
    ...location,
    employeeCount: sortedMembers.length,
    managers: managers.map((manager) => manager.managerName),
    members: sortedMembers,
  });
}).pipe(
  Effect.catchAll((error) =>
    error instanceof Error
      ? json({ error: error.message }, 400)
      : json({ error: "failed to load location" }, 400),
  ),
);

const createLocation = Effect.gen(function* () {
  const { id: organizationId } = yield* HttpRouter.schemaPathParams(OrgParams);
  const authorized = yield* requireManagerOrAdmin(organizationId).pipe(
    Effect.either,
  );
  if (authorized._tag === "Left") {
    return yield* handleAuthorizationError(authorized.left);
  }
  const billing = yield* enforceBillingAccess(organizationId);
  if (billing._tag === "Left") {
    return yield* handleAuthorizationError(billing.left);
  }

  const body = yield* parseJsonBody(LocationCreateBody).pipe(
    Effect.catchAll(() => Effect.fail(new Error("invalid request body"))),
  );
  const name = body.name.trim();
  if (name === "") {
    return yield* json({ error: "name is required" }, 400);
  }
  const address = body.address.trim();
  if (address === "") {
    return yield* json({ error: "address is required" }, 400);
  }
  const city = body.city.trim();
  if (city === "") {
    return yield* json({ error: "city is required" }, 400);
  }
  const state = body.state.trim();
  if (state === "") {
    return yield* json({ error: "state is required" }, 400);
  }

  const inserted = yield* Effect.tryPromise({
    try: () =>
      db
        .insert(locations)
        .values({ organizationId, name, address, city, state })
        .returning(),
    catch: () => new Error("failed to create location"),
  });

  yield* Effect.tryPromise({
    try: () => syncSubscriptionQuantityForOrganization(organizationId),
    catch: () => new Error("failed to sync billing quantity"),
  });

  return yield* json(inserted[0], 201);
}).pipe(
  Effect.catchAll((error) =>
    error instanceof Error
      ? json({ error: error.message }, 400)
      : json({ error: "failed to create location" }, 400),
  ),
);

const updateLocation = Effect.gen(function* () {
  const { id: organizationId, locationId } =
    yield* HttpRouter.schemaPathParams(OrgLocationParams);

  const orgOk = yield* requireOrganizationAccess(organizationId).pipe(
    Effect.either,
  );
  if (orgOk._tag === "Left") {
    return yield* handleAuthorizationError(orgOk.left);
  }

  const locAuth = yield* requireLocationAccess(locationId).pipe(Effect.either);
  if (locAuth._tag === "Left") {
    return yield* handleAuthorizationError(locAuth.left);
  }
  const billing = yield* enforceBillingAccess(organizationId);
  if (billing._tag === "Left") {
    return yield* handleAuthorizationError(billing.left);
  }

  const locationRows = yield* Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(locations)
        .where(
          and(
            eq(locations.id, locationId),
            eq(locations.organizationId, organizationId),
          ),
        )
        .limit(1),
    catch: () => new Error("failed to validate location"),
  });

  const loc = locationRows[0];
  if (!loc) {
    return yield* json({ error: "location not found" }, 404);
  }

  const body = yield* parseJsonBody(LocationUpdateBody).pipe(
    Effect.catchAll(() => Effect.fail(new Error("invalid request body"))),
  );
  const name = body.name.trim();
  if (name === "") {
    return yield* json({ error: "name is required" }, 400);
  }
  const address = body.address.trim();
  if (address === "") {
    return yield* json({ error: "address is required" }, 400);
  }
  const city = body.city.trim();
  if (city === "") {
    return yield* json({ error: "city is required" }, 400);
  }
  const state = body.state.trim();
  if (state === "") {
    return yield* json({ error: "state is required" }, 400);
  }

  const updated = yield* Effect.tryPromise({
    try: () =>
      db
        .update(locations)
        .set({ name, address, city, state, updatedAt: new Date() })
        .where(eq(locations.id, locationId))
        .returning(),
    catch: () => new Error("failed to update location"),
  });

  return yield* json(updated[0]);
}).pipe(
  Effect.catchAll((error) =>
    error instanceof Error
      ? json({ error: error.message }, 400)
      : json({ error: "failed to update location" }, 400),
  ),
);

const listDepartments = Effect.gen(function* () {
  const { id: organizationId } = yield* HttpRouter.schemaPathParams(OrgParams);

  const authorized = yield* requireOrganizationAccess(organizationId).pipe(
    Effect.either,
  );
  if (authorized._tag === "Left") {
    return yield* handleAuthorizationError(authorized.left);
  }

  const viewer = authorized.right;
  const visibility = yield* Effect.tryPromise({
    try: () => getOrganizationalVisibility(viewer, organizationId),
    catch: () => new Error("failed to resolve visibility"),
  });

  let rows;
  if (visibility.kind === "all") {
    const joined = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ department: departments })
          .from(departments)
          .innerJoin(locations, eq(departments.locationId, locations.id))
          .where(eq(locations.organizationId, organizationId)),
      catch: () => new Error("failed to list departments"),
    });

    rows = joined.map((entry) => entry.department);
  } else {
    rows = yield* Effect.tryPromise({
      try: async () => {
        const base = await db
          .select({ department: departments })
          .from(departments)
          .innerJoin(locations, eq(departments.locationId, locations.id))
          .where(eq(locations.organizationId, organizationId));
        return base
          .filter((entry) =>
            departmentMatchesVisibility(visibility, entry.department),
          )
          .map((entry) => entry.department);
      },
      catch: () => new Error("failed to list departments"),
    });
  }

  rows.sort((first, second) =>
    `${first.locationId}:${first.name}`.localeCompare(
      `${second.locationId}:${second.name}`,
    ),
  );
  return yield* json(rows);
}).pipe(
  Effect.catchAll((error) =>
    error instanceof Error
      ? json({ error: error.message }, 400)
      : json({ error: "failed to list departments" }, 400),
  ),
);

const createDepartment = Effect.gen(function* () {
  const { id: organizationId } = yield* HttpRouter.schemaPathParams(OrgParams);

  const body = yield* parseJsonBody(DepartmentCreateBody).pipe(
    Effect.catchAll(() => Effect.fail(new Error("invalid request body"))),
  );
  const locationId = body.locationId;
  const name = body.name.trim();
  if (name === "") {
    return yield* json({ error: "name is required" }, 400);
  }

  const authorized = yield* requireLocationAccess(locationId).pipe(
    Effect.either,
  );
  if (authorized._tag === "Left") {
    return yield* handleAuthorizationError(authorized.left);
  }
  const billing = yield* enforceBillingAccess(organizationId);
  if (billing._tag === "Left") {
    return yield* handleAuthorizationError(billing.left);
  }

  const rows = yield* Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(locations)
        .where(
          and(
            eq(locations.id, locationId),
            eq(locations.organizationId, organizationId),
          ),
        )
        .limit(1),
    catch: () => new Error("failed to validate location"),
  });

  if (!rows[0]) {
    return yield* json({ error: "location not found" }, 404);
  }

  const inserted = yield* Effect.tryPromise({
    try: () => db.insert(departments).values({ locationId, name }).returning(),
    catch: () => new Error("failed to create department"),
  });

  return yield* json(inserted[0], 201);
}).pipe(
  Effect.catchAll((error) =>
    error instanceof Error
      ? json({ error: error.message }, 400)
      : json({ error: "failed to create department" }, 400),
  ),
);

const updateDepartment = Effect.gen(function* () {
  const { id: organizationId, departmentId } =
    yield* HttpRouter.schemaPathParams(OrgDeptParams);

  const orgOk = yield* requireOrganizationAccess(organizationId).pipe(
    Effect.either,
  );
  if (orgOk._tag === "Left") {
    return yield* handleAuthorizationError(orgOk.left);
  }

  const depAuth = yield* requireDepartmentAccess(departmentId).pipe(
    Effect.either,
  );
  if (depAuth._tag === "Left") {
    return yield* handleAuthorizationError(depAuth.left);
  }
  const billing = yield* enforceBillingAccess(organizationId);
  if (billing._tag === "Left") {
    return yield* handleAuthorizationError(billing.left);
  }

  const existing = yield* Effect.tryPromise({
    try: () =>
      db
        .select({ department: departments })
        .from(departments)
        .innerJoin(locations, eq(departments.locationId, locations.id))
        .where(
          and(
            eq(departments.id, departmentId),
            eq(locations.organizationId, organizationId),
          ),
        )
        .limit(1),
    catch: () => new Error("failed to validate department"),
  });

  const row = existing[0]?.department;
  if (!row) {
    return yield* json({ error: "department not found" }, 404);
  }

  const body = yield* parseJsonBody(DepartmentUpdateBody).pipe(
    Effect.catchAll(() => Effect.fail(new Error("invalid request body"))),
  );
  const name = body.name.trim();
  if (name === "") {
    return yield* json({ error: "name is required" }, 400);
  }

  const updated = yield* Effect.tryPromise({
    try: () =>
      db
        .update(departments)
        .set({ name, updatedAt: new Date() })
        .where(eq(departments.id, departmentId))
        .returning(),
    catch: () => new Error("failed to update department"),
  });

  return yield* json(updated[0]);
}).pipe(
  Effect.catchAll((error) =>
    error instanceof Error
      ? json({ error: error.message }, 400)
      : json({ error: "failed to update department" }, 400),
  ),
);

const listAllManagerScopes = Effect.gen(function* () {
  const { id: organizationId } = yield* HttpRouter.schemaPathParams(OrgParams);

  const admin = yield* requireOrganizationAdmin(organizationId).pipe(
    Effect.either,
  );
  if (admin._tag === "Left") {
    return yield* handleAuthorizationError(admin.left);
  }

  const rows = yield* Effect.tryPromise({
    try: () =>
      db
        .select({ scope: managerScopes })
        .from(managerScopes)
        .innerJoin(employees, eq(managerScopes.employeeId, employees.id))
        .where(eq(employees.organizationId, organizationId)),
    catch: () => new Error("failed to list manager scopes"),
  });

  return yield* json(rows.map((r) => r.scope));
}).pipe(
  Effect.catchAll((error) =>
    error instanceof Error
      ? json({ error: error.message }, 400)
      : json({ error: "failed to list manager scopes" }, 400),
  ),
);

const listEmployeeManagerScopes = Effect.gen(function* () {
  const { id: organizationId, employeeId } =
    yield* HttpRouter.schemaPathParams(OrgEmpScopeParams);

  const admin = yield* requireOrganizationAdmin(organizationId).pipe(
    Effect.either,
  );
  if (admin._tag === "Left") {
    return yield* handleAuthorizationError(admin.left);
  }

  const targetRows = yield* Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(employees)
        .where(
          and(
            eq(employees.id, employeeId),
            eq(employees.organizationId, organizationId),
          ),
        )
        .limit(1),
    catch: () => new Error("failed to validate employee"),
  });

  if (!targetRows[0]) {
    return yield* json({ error: "employee not found" }, 404);
  }

  const scopes = yield* Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(managerScopes)
        .where(eq(managerScopes.employeeId, employeeId)),
    catch: () => new Error("failed to load manager scopes"),
  });

  return yield* json(scopes);
}).pipe(
  Effect.catchAll((error) =>
    error instanceof Error
      ? json({ error: error.message }, 400)
      : json({ error: "failed to load manager scopes" }, 400),
  ),
);

const assignManagerScope = Effect.gen(function* () {
  const { id: organizationId } = yield* HttpRouter.schemaPathParams(OrgParams);
  const admin = yield* requireOrganizationAdmin(organizationId).pipe(
    Effect.either,
  );
  if (admin._tag === "Left") {
    return yield* handleAuthorizationError(admin.left);
  }
  const billing = yield* enforceBillingAccess(organizationId);
  if (billing._tag === "Left") {
    return yield* handleAuthorizationError(billing.left);
  }

  const body = yield* parseJsonBody(ManagerScopeMutationBody).pipe(
    Effect.catchAll(() => Effect.fail(new Error("invalid request body"))),
  );

  const targetRows = yield* Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(employees)
        .where(
          and(
            eq(employees.id, body.employeeId),
            eq(employees.organizationId, organizationId),
          ),
        )
        .limit(1),
    catch: () => new Error("failed to validate employee"),
  });

  if (!targetRows[0]) {
    return yield* json({ error: "employee not found" }, 404);
  }

  const okScope = yield* Effect.tryPromise({
    try: () =>
      assertScopeBelongsToOrganization(
        organizationId,
        body.scopeType,
        body.scopeId,
      ),
    catch: () => new Error("failed to validate scope"),
  });

  if (!okScope) {
    return yield* json({ error: "unknown scope resource" }, 400);
  }

  const duplicate = yield* Effect.tryPromise({
    try: () =>
      db
        .select({ id: managerScopes.id })
        .from(managerScopes)
        .where(
          and(
            eq(managerScopes.employeeId, body.employeeId),
            eq(managerScopes.scopeType, body.scopeType),
            eq(managerScopes.scopeId, body.scopeId),
          ),
        )
        .limit(1),
    catch: () => new Error("failed to validate duplicate scope"),
  });

  if (duplicate[0]) {
    return yield* json({ error: "scope assignment already exists" }, 409);
  }

  const inserted = yield* Effect.tryPromise({
    try: () =>
      db
        .insert(managerScopes)
        .values({
          employeeId: body.employeeId,
          scopeType: body.scopeType,
          scopeId: body.scopeId,
        })
        .returning(),
    catch: () => new Error("failed to assign manager scope"),
  });

  return yield* json(inserted[0], 201);
}).pipe(
  Effect.catchAll((error) =>
    error instanceof Error
      ? json({ error: error.message }, 400)
      : json({ error: "failed to assign manager scope" }, 400),
  ),
);

const revokeManagerScope = Effect.gen(function* () {
  const { id: organizationId, recordId } =
    yield* HttpRouter.schemaPathParams(OrgScopeRecordParams);

  const admin = yield* requireOrganizationAdmin(organizationId).pipe(
    Effect.either,
  );
  if (admin._tag === "Left") {
    return yield* handleAuthorizationError(admin.left);
  }
  const billing = yield* enforceBillingAccess(organizationId);
  if (billing._tag === "Left") {
    return yield* handleAuthorizationError(billing.left);
  }

  const row = yield* Effect.tryPromise({
    try: () =>
      db
        .select({ scope: managerScopes })
        .from(managerScopes)
        .innerJoin(employees, eq(managerScopes.employeeId, employees.id))
        .where(
          and(
            eq(managerScopes.id, recordId),
            eq(employees.organizationId, organizationId),
          ),
        )
        .limit(1),
    catch: () => new Error("failed to revoke manager scope"),
  });

  if (!row[0]) {
    return yield* json({ error: "scope assignment not found" }, 404);
  }

  yield* Effect.tryPromise({
    try: () => db.delete(managerScopes).where(eq(managerScopes.id, recordId)),
    catch: () => new Error("failed to revoke manager scope"),
  });

  return yield* json({ ok: true });
}).pipe(
  Effect.catchAll((error) =>
    error instanceof Error
      ? json({ error: error.message }, 400)
      : json({ error: "failed to revoke manager scope" }, 400),
  ),
);

export const ScopedResourcesGroupLive = HttpRouter.empty.pipe(
  HttpRouter.get("/organizations/:id/locations", listLocations),
  HttpRouter.get(
    "/organizations/:id/locations/by-name/:locationName",
    getLocationByName,
  ),
  HttpRouter.post("/organizations/:id/locations", createLocation),
  HttpRouter.patch("/organizations/:id/locations/:locationId", updateLocation),

  HttpRouter.get("/organizations/:id/departments", listDepartments),
  HttpRouter.post("/organizations/:id/departments", createDepartment),
  HttpRouter.patch(
    "/organizations/:id/departments/:departmentId",
    updateDepartment,
  ),

  HttpRouter.get("/organizations/:id/manager-scopes", listAllManagerScopes),
  HttpRouter.get(
    "/organizations/:id/employees/:employeeId/manager-scopes",
    listEmployeeManagerScopes,
  ),
  HttpRouter.post("/organizations/:id/manager-scopes", assignManagerScope),
  HttpRouter.del(
    "/organizations/:id/manager-scopes/:recordId",
    revokeManagerScope,
  ),
);
