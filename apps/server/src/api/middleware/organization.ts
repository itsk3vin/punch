import {
  HttpRouter,
  HttpServerRequest,
} from "@effect/platform"
import { and, eq } from "drizzle-orm"
import { Effect, Schema } from "effect"

import { verifyBearerToken } from "../../auth.js"
import { db } from "../../db/index.js"
import {
  departments,
  employees,
  locationGroupLocations,
  locationGroups,
  locations,
  managerScopes,
} from "../../db/schema.js"
import { json } from "../response.js"

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

const AuthorizationHeaders = Schema.Struct({
  authorization: Schema.optional(Schema.String),
})

const ADMIN_ROLE = "admin"
const MANAGER_ROLE = "manager"

const getAuthenticatedEmployee = Effect.gen(function* () {
  const { authorization } = yield* HttpServerRequest.schemaHeaders(AuthorizationHeaders).pipe(
    Effect.mapError(() => new ApiError("unauthorized", 401)),
  )

  const claims = yield* Effect.tryPromise({
    try: () => verifyBearerToken(authorization),
    catch: () => new ApiError("unauthorized", 401),
  })

  const results = yield* Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(employees)
        .where(eq(employees.userId, claims.sub))
        .limit(1),
    catch: () => new ApiError("failed to authorize request", 500),
  })

  const currentEmployee = results[0]
  if (!currentEmployee) {
    return yield* Effect.fail(new ApiError("employee not found", 403))
  }

  return currentEmployee
})

const authorizationError = (error: unknown) => {
  if (error instanceof ApiError) {
    return json({ error: error.message }, error.status)
  }

  return json({ error: "unauthorized" }, 401)
}

export const requireOrganizationAccess = (organizationId: string) =>
  Effect.gen(function* () {
    const currentEmployee = yield* getAuthenticatedEmployee

    if (currentEmployee.organizationId !== organizationId) {
      return yield* Effect.fail(new ApiError("forbidden", 403))
    }

    return currentEmployee
  })

export const requireOrganizationAdmin = (organizationId: string) =>
  Effect.gen(function* () {
    const currentEmployee = yield* requireOrganizationAccess(organizationId)

    if (currentEmployee.role !== ADMIN_ROLE) {
      return yield* Effect.fail(new ApiError("forbidden", 403))
    }

    return currentEmployee
  })

async function managerHasScopedAccessToLocation(
  employeeId: string,
  locationId: string,
): Promise<boolean> {
  const directLocation = await db
    .select({ id: managerScopes.id })
    .from(managerScopes)
    .where(and(
      eq(managerScopes.employeeId, employeeId),
      eq(managerScopes.scopeType, "location"),
      eq(managerScopes.scopeId, locationId),
    ))
    .limit(1)
  if (directLocation.length > 0) {
    return true
  }

  const viaLocationGroup = await db
    .select({ id: managerScopes.id })
    .from(managerScopes)
    .innerJoin(
      locationGroupLocations,
      eq(locationGroupLocations.locationGroupId, managerScopes.scopeId),
    )
    .where(and(
      eq(managerScopes.employeeId, employeeId),
      eq(managerScopes.scopeType, "location_group"),
      eq(locationGroupLocations.locationId, locationId),
    ))
    .limit(1)
  return viaLocationGroup.length > 0
}

async function employeeHasScopedAccessToLocation(
  employee: typeof employees.$inferSelect,
  locationId: string,
  organizationId: string,
): Promise<boolean> {
  if (employee.organizationId !== organizationId) {
    return false
  }
  if (employee.role === ADMIN_ROLE) {
    return true
  }
  if (employee.role !== MANAGER_ROLE) {
    return false
  }
  return managerHasScopedAccessToLocation(employee.id, locationId)
}

async function employeeHasScopedAccessToDepartment(
  employee: typeof employees.$inferSelect,
  departmentId: string,
  departmentLocationId: string,
  organizationId: string,
): Promise<boolean> {
  if (employee.organizationId !== organizationId) {
    return false
  }
  if (employee.role === ADMIN_ROLE) {
    return true
  }
  if (employee.role !== MANAGER_ROLE) {
    return false
  }

  const directDepartment = await db
    .select({ id: managerScopes.id })
    .from(managerScopes)
    .where(and(
      eq(managerScopes.employeeId, employee.id),
      eq(managerScopes.scopeType, "department"),
      eq(managerScopes.scopeId, departmentId),
    ))
    .limit(1)
  if (directDepartment.length > 0) {
    return true
  }

  const directLocationScope = await db
    .select({ id: managerScopes.id })
    .from(managerScopes)
    .where(and(
      eq(managerScopes.employeeId, employee.id),
      eq(managerScopes.scopeType, "location"),
      eq(managerScopes.scopeId, departmentLocationId),
    ))
    .limit(1)
  if (directLocationScope.length > 0) {
    return true
  }

  return managerHasScopedAccessToLocation(employee.id, departmentLocationId)
}

async function employeeHasAnyManagerScopeInOrganization(
  employeeId: string,
  organizationId: string,
): Promise<boolean> {
  const locationGroupScopes = await db
    .select({ id: managerScopes.id })
    .from(managerScopes)
    .innerJoin(locationGroups, eq(locationGroups.id, managerScopes.scopeId))
    .where(and(
      eq(managerScopes.employeeId, employeeId),
      eq(managerScopes.scopeType, "location_group"),
      eq(locationGroups.organizationId, organizationId),
    ))
    .limit(1)
  if (locationGroupScopes.length > 0) {
    return true
  }

  const locationScopes = await db
    .select({ id: managerScopes.id })
    .from(managerScopes)
    .innerJoin(locations, eq(locations.id, managerScopes.scopeId))
    .where(and(
      eq(managerScopes.employeeId, employeeId),
      eq(managerScopes.scopeType, "location"),
      eq(locations.organizationId, organizationId),
    ))
    .limit(1)
  if (locationScopes.length > 0) {
    return true
  }

  const departmentScopes = await db
    .select({ id: managerScopes.id })
    .from(managerScopes)
    .innerJoin(departments, eq(departments.id, managerScopes.scopeId))
    .innerJoin(locations, eq(departments.locationId, locations.id))
    .where(and(
      eq(managerScopes.employeeId, employeeId),
      eq(managerScopes.scopeType, "department"),
      eq(locations.organizationId, organizationId),
    ))
    .limit(1)
  return departmentScopes.length > 0
}

/** Scope entries for GET /me (names joined for UI). */
export type MeScopePayload =
  | { type: "location_group"; id: string; name: string }
  | { type: "location"; id: string; name: string }
  | { type: "department"; id: string; name: string }

export async function fetchEmployeeScopesForMe(employeeId: string): Promise<MeScopePayload[]> {
  const groupRows = await db
    .select({
      id: managerScopes.scopeId,
      name: locationGroups.name,
    })
    .from(managerScopes)
    .innerJoin(locationGroups, eq(locationGroups.id, managerScopes.scopeId))
    .where(and(
      eq(managerScopes.employeeId, employeeId),
      eq(managerScopes.scopeType, "location_group"),
    ))

  const locationRows = await db
    .select({
      id: managerScopes.scopeId,
      name: locations.name,
    })
    .from(managerScopes)
    .innerJoin(locations, eq(locations.id, managerScopes.scopeId))
    .where(and(
      eq(managerScopes.employeeId, employeeId),
      eq(managerScopes.scopeType, "location"),
    ))

  const departmentRows = await db
    .select({
      id: managerScopes.scopeId,
      name: departments.name,
    })
    .from(managerScopes)
    .innerJoin(departments, eq(departments.id, managerScopes.scopeId))
    .where(and(
      eq(managerScopes.employeeId, employeeId),
      eq(managerScopes.scopeType, "department"),
    ))

  return [
    ...groupRows.map((r) => ({
      type: "location_group" as const,
      id: r.id,
      name: r.name,
    })),
    ...locationRows.map((r) => ({ type: "location" as const, id: r.id, name: r.name })),
    ...departmentRows.map((r) => ({ type: "department" as const, id: r.id, name: r.name })),
  ]
}

/** Admin of org, manager with location scope, or manager whose location_group includes the location. */
export const requireLocationAccess = (locationId: string) =>
  Effect.gen(function* () {
    const employee = yield* getAuthenticatedEmployee

    const locationRows = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(locations)
          .where(eq(locations.id, locationId))
          .limit(1),
      catch: () => new ApiError("failed to authorize request", 500),
    })

    const locationRow = locationRows[0]
    if (!locationRow) {
      return yield* Effect.fail(new ApiError("forbidden", 403))
    }

    const ok = yield* Effect.tryPromise({
      try: () =>
        employeeHasScopedAccessToLocation(
          employee,
          locationId,
          locationRow.organizationId,
        ),
      catch: () => new ApiError("failed to authorize request", 500),
    })

    if (!ok) {
      return yield* Effect.fail(new ApiError("forbidden", 403))
    }

    return employee
  })

/** Admin of org, department-scoped manager, location-scoped manager for parent location, or group covering parent location. */
export const requireDepartmentAccess = (departmentId: string) =>
  Effect.gen(function* () {
    const employee = yield* getAuthenticatedEmployee

    const departmentRows = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            department: departments,
            location: locations,
          })
          .from(departments)
          .innerJoin(locations, eq(departments.locationId, locations.id))
          .where(eq(departments.id, departmentId))
          .limit(1),
      catch: () => new ApiError("failed to authorize request", 500),
    })

    const row = departmentRows[0]
    if (!row) {
      return yield* Effect.fail(new ApiError("forbidden", 403))
    }

    const organizationId = row.location.organizationId
    const ok = yield* Effect.tryPromise({
      try: () =>
        employeeHasScopedAccessToDepartment(
          employee,
          departmentId,
          row.department.locationId,
          organizationId,
        ),
      catch: () => new ApiError("failed to authorize request", 500),
    })

    if (!ok) {
      return yield* Effect.fail(new ApiError("forbidden", 403))
    }

    return employee
  })

/** Admin or manager with any scope referencing an entity in the organization. */
export const requireManagerOrAdmin = (organizationId: string) =>
  Effect.gen(function* () {
    const employee = yield* requireOrganizationAccess(organizationId)

    if (employee.role === ADMIN_ROLE) {
      return employee
    }

    if (employee.role !== MANAGER_ROLE) {
      return yield* Effect.fail(new ApiError("forbidden", 403))
    }

    const hasScope = yield* Effect.tryPromise({
      try: () =>
        employeeHasAnyManagerScopeInOrganization(employee.id, organizationId),
      catch: () => new ApiError("failed to authorize request", 500),
    })

    if (!hasScope) {
      return yield* Effect.fail(new ApiError("forbidden", 403))
    }

    return employee
  })

/**
 * Scoped invitation actions: admin always; otherwise manager covering the invitation target.
 * Org-wide invitations (no location/department) are admin-only.
 */
export const requireInvitationAuthority = (
  organizationId: string,
  locationId?: string | null,
  departmentId?: string | null,
) =>
  Effect.gen(function* () {
    const employee = yield* requireOrganizationAccess(organizationId)

    if (employee.role === ADMIN_ROLE) {
      return employee
    }

    if (departmentId) {
      const departmentRows = yield* Effect.tryPromise({
        try: () =>
          db
            .select({
              department: departments,
              location: locations,
            })
            .from(departments)
            .innerJoin(locations, eq(departments.locationId, locations.id))
            .where(eq(departments.id, departmentId))
            .limit(1),
        catch: () => new ApiError("failed to authorize request", 500),
      })

      const row = departmentRows[0]
      if (!row || row.location.organizationId !== organizationId) {
        return yield* Effect.fail(new ApiError("forbidden", 403))
      }

      const ok = yield* Effect.tryPromise({
        try: () =>
          employeeHasScopedAccessToDepartment(
            employee,
            departmentId,
            row.department.locationId,
            organizationId,
          ),
        catch: () => new ApiError("failed to authorize request", 500),
      })
      if (!ok) {
        return yield* Effect.fail(new ApiError("forbidden", 403))
      }
      return employee
    }

    if (locationId) {
      const locationRows = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(locations)
            .where(eq(locations.id, locationId))
            .limit(1),
        catch: () => new ApiError("failed to authorize request", 500),
      })
      const loc = locationRows[0]
      if (!loc || loc.organizationId !== organizationId) {
        return yield* Effect.fail(new ApiError("forbidden", 403))
      }

      const ok = yield* Effect.tryPromise({
        try: () =>
          employeeHasScopedAccessToLocation(employee, locationId, organizationId),
        catch: () => new ApiError("failed to authorize request", 500),
      })
      if (!ok) {
        return yield* Effect.fail(new ApiError("forbidden", 403))
      }
      return employee
    }

    return yield* Effect.fail(new ApiError("forbidden", 403))
  })

export const requirePathOrganizationAccess = Effect.gen(function* () {
  const { id: organizationId } = yield* HttpRouter.schemaPathParams(Schema.Struct({
    id: Schema.String,
  }))

  return yield* requireOrganizationAccess(organizationId)
}).pipe(
  Effect.catchAll(authorizationError),
)

export const handleAuthorizationError = authorizationError
