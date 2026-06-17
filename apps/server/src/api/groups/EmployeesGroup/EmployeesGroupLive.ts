import {
  HttpRouter,
  HttpServerRequest,
} from "@effect/platform"
import { and, eq } from "drizzle-orm"
import { Effect, Schema } from "effect"

import { db } from "../../db/index.js"
import { departments, employees, locations } from "../../db/schema.js"
import {
  handleAuthorizationError,
  requireOrganizationAccess,
  requireOrganizationAdmin,
} from "../middleware/organization.js"
import {
  buildDepartmentParentMap,
  coworkerMatchesVisibility,
  getOrganizationalVisibility,
} from "../middleware/resourceScope.js"
import { json } from "../response.js"

const CreateEmployeeBody = Schema.Struct({
  userId: Schema.optional(Schema.String),
  organizationId: Schema.optional(Schema.String),
  email: Schema.String,
  name: Schema.String,
  role: Schema.optional(Schema.String),
})

const AdminUpdateEmployeeBody = Schema.Struct({
  id: Schema.String,
  email: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  role: Schema.optional(Schema.String),
  locationId: Schema.optional(Schema.Union(Schema.Null, Schema.String)),
  departmentId: Schema.optional(Schema.Union(Schema.Null, Schema.String)),
})

const RemoveEmployeeBody = Schema.Struct({
  id: Schema.String,
})

const IdPathParams = Schema.Struct({
  id: Schema.String,
})

const parseJsonBody = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  HttpServerRequest.schemaBodyJson(schema).pipe(
    Effect.mapError(() => new Error("invalid request body")),
  )

const getEmployeeFromUserId = Effect.gen(function* () {
  const { id: userId } = yield* HttpRouter.schemaPathParams(IdPathParams)

  const results = yield* Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(employees)
        .where(eq(employees.userId, userId))
        .limit(1),
    catch: () => new Error("failed to get employee"),
  })

  const targetEmployee = results[0]
  if (!targetEmployee) {
    return yield* json({ error: "employee not found" }, 404)
  }

  if (!targetEmployee.organizationId) {
    return yield* json({ error: "forbidden" }, 403)
  }

  const authorized = yield* requireOrganizationAccess(targetEmployee.organizationId).pipe(
    Effect.either,
  )
  if (authorized._tag === "Left") {
    return yield* handleAuthorizationError(authorized.left)
  }

  return yield* json(targetEmployee)
})

const createEmployee = Effect.gen(function* () {
  const body = yield* parseJsonBody(CreateEmployeeBody).pipe(
    Effect.catchAll(() => Effect.fail(new Error("invalid request body"))),
  )

  const created = yield* Effect.tryPromise({
    try: () =>
      db
        .insert(employees)
        .values(body)
        .returning(),
    catch: () => new Error("failed to create employee"),
  })

  return yield* json(created[0], 201)
}).pipe(
  Effect.catchAll((error) => json({ error: error.message }, 400)),
)

const updateEmployee = Effect.gen(function* () {
  const body = yield* parseJsonBody(AdminUpdateEmployeeBody).pipe(
    Effect.catchAll(() => Effect.fail(new Error("invalid request body"))),
  )
  const {
    id,
    name,
    email,
    role,
    locationId: nextLocationId,
    departmentId: nextDepartmentId,
  } = body

  const existingRows = yield* Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(employees)
        .where(eq(employees.id, id))
        .limit(1),
    catch: () => new Error("failed to get employee"),
  })

  const target = existingRows[0]
  if (!target) {
    return yield* json({ error: "employee not found" }, 404)
  }

  if (!target.organizationId) {
    return yield* json({ error: "forbidden" }, 403)
  }

  const organizationId = target.organizationId

  const authorized = yield* requireOrganizationAdmin(organizationId).pipe(
    Effect.either,
  )
  if (authorized._tag === "Left") {
    return yield* handleAuthorizationError(authorized.left)
  }

  const updates: {
    name?: string
    email?: string
    role?: string
    locationId?: string | null
    departmentId?: string | null
    updatedAt: Date
  } = { updatedAt: new Date() }

  if (name !== undefined) {
    const next = name.trim()
    if (next === "") {
      return yield* json({ error: "name is required" }, 400)
    }
    updates.name = next
  }

  if (email !== undefined) {
    const next = email.trim().toLowerCase()
    if (next === "") {
      return yield* json({ error: "email is required" }, 400)
    }
    updates.email = next
  }

  if (role !== undefined) {
    updates.role = role
  }

  /** Effective FK targets after PATCH for validation (explicit or unchanged). */
  let effectiveLocationId = target.locationId

  if (nextLocationId !== undefined) {
    if (nextLocationId === null) {
      updates.locationId = null
      effectiveLocationId = null
    }
    else {
      const row = yield* Effect.tryPromise({
        try: () =>
          db
            .select({ id: locations.id })
            .from(locations)
            .where(and(
              eq(locations.id, nextLocationId),
              eq(locations.organizationId, organizationId),
            ))
            .limit(1),
        catch: () => new Error("failed to validate location"),
      })
      if (!row[0]) {
        return yield* json({ error: "location not found" }, 400)
      }
      updates.locationId = row[0].id
      effectiveLocationId = row[0].id
    }
  }

  if (nextDepartmentId !== undefined) {
    if (nextDepartmentId === null) {
      updates.departmentId = null
    }
    else {
      const dRow = yield* Effect.tryPromise({
        try: () =>
          db
            .select({
              deptId: departments.id,
              locId: departments.locationId,
            })
            .from(departments)
            .innerJoin(locations, eq(departments.locationId, locations.id))
            .where(and(
              eq(departments.id, nextDepartmentId),
              eq(locations.organizationId, organizationId),
            ))
            .limit(1),
        catch: () => new Error("failed to validate department"),
      })
      const d = dRow[0]
      if (!d) {
        return yield* json({ error: "department not found" }, 400)
      }
      updates.departmentId = d.deptId
      if (
        effectiveLocationId !== null &&
        effectiveLocationId !== undefined &&
        d.locId !== effectiveLocationId
      ) {
        return yield* json({ error: "department not at employee location" }, 400)
      }
    }
  }

  /** If department was set/changed without location PATCH, dept implies parent location. */
  if (
    nextDepartmentId !== undefined &&
    nextDepartmentId !== null &&
    effectiveLocationId === null
  ) {
    const deptLoc = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ locationId: departments.locationId })
          .from(departments)
          .where(and(
            eq(departments.id, nextDepartmentId),
          ))
          .limit(1),
      catch: () => new Error("failed to resolve department"),
    })
    updates.locationId = deptLoc[0]?.locationId ?? null
  }

  if (Object.keys(updates).length === 1) {
    return yield* json({ error: "no updates provided" }, 400)
  }

  const updated = yield* Effect.tryPromise({
    try: () =>
      db
        .update(employees)
        .set(updates)
        .where(eq(employees.id, id))
        .returning(),
    catch: () => new Error("failed to update employee"),
  })

  if (updated.length === 0) {
    return yield* json({ error: "employee not found" }, 404)
  }

  return yield* json(updated[0])
}).pipe(
  Effect.catchAll((error) => json({ error: error.message }, 400)),
)

const removeEmployee = Effect.gen(function* () {
  const body = yield* parseJsonBody(RemoveEmployeeBody).pipe(
    Effect.catchAll(() => Effect.fail(new Error("invalid request body"))),
  )

  const existingRows = yield* Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(employees)
        .where(eq(employees.id, body.id))
        .limit(1),
    catch: () => new Error("failed to get employee"),
  })

  const target = existingRows[0]
  if (!target) {
    return yield* json({ error: "employee not found" }, 404)
  }

  if (!target.organizationId) {
    return yield* json({ error: "forbidden" }, 403)
  }

  const authorized = yield* requireOrganizationAdmin(target.organizationId).pipe(
    Effect.either,
  )
  if (authorized._tag === "Left") {
    return yield* handleAuthorizationError(authorized.left)
  }

  yield* Effect.tryPromise({
    try: () =>
      db
        .delete(employees)
        .where(eq(employees.id, body.id)),
    catch: () => new Error("failed to remove employee"),
  })

  return yield* json({ ok: true })
}).pipe(
  Effect.catchAll((error) => json({ error: error.message }, 400)),
)

const getAllEmployeesByOrganizationId = Effect.gen(function* () {
  const { id: organizationId } = yield* HttpRouter.schemaPathParams(IdPathParams)

  const authorized = yield* requireOrganizationAccess(organizationId).pipe(
    Effect.either,
  )
  if (authorized._tag === "Left") {
    return yield* handleAuthorizationError(authorized.left)
  }

  const viewer = authorized.right
  const visibility = yield* Effect.tryPromise({
    try: () => getOrganizationalVisibility(viewer, organizationId),
    catch: () => new Error("failed to resolve visibility"),
  })

  const results = yield* Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(employees)
        .where(eq(employees.organizationId, organizationId)),
    catch: () => new Error("failed to list employees"),
  })

  if (visibility.kind === "all") {
    return yield* json(results)
  }

  const parentMap = yield* Effect.tryPromise({
    try: () =>
      buildDepartmentParentMap(results.map((e) => e.departmentId)),
    catch: () => new Error("failed to resolve department parents"),
  })

  const filtered = results.filter((row) =>
    coworkerMatchesVisibility(visibility, row, parentMap),
  )

  return yield* json(filtered)
})

export const EmployeesGroupLive = HttpRouter.empty.pipe(
  HttpRouter.get("/employee/:id", getEmployeeFromUserId),
  HttpRouter.post("/employee/create", createEmployee),
  HttpRouter.put("/employee/update", updateEmployee),
  HttpRouter.post("/employee/remove", removeEmployee),
  HttpRouter.get("/employees/org/:id", getAllEmployeesByOrganizationId),
)
