import {
  HttpRouter,
  HttpServerRequest,
} from "@effect/platform"
import { eq } from "drizzle-orm"
import { Effect, Schema } from "effect"

import { db } from "../../db/index.js"
import { employees } from "../../db/schema.js"
import {
  handleAuthorizationError,
  requireOrganizationAccess,
  requireOrganizationAdmin,
} from "../middleware/organization.js"
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
  const { id, name, email, role } = body

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

  const authorized = yield* requireOrganizationAdmin(target.organizationId).pipe(
    Effect.either,
  )
  if (authorized._tag === "Left") {
    return yield* handleAuthorizationError(authorized.left)
  }

  const updates: {
    name?: string
    email?: string
    role?: string
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

  const results = yield* Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(employees)
        .where(eq(employees.organizationId, organizationId)),
    catch: () => new Error("failed to list employees"),
  })

  return yield* json(results)
})

export const EmployeesGroupLive = HttpRouter.empty.pipe(
  HttpRouter.get("/employee/:id", getEmployeeFromUserId),
  HttpRouter.post("/employee/create", createEmployee),
  HttpRouter.put("/employee/update", updateEmployee),
  HttpRouter.post("/employee/remove", removeEmployee),
  HttpRouter.get("/employees/org/:id", getAllEmployeesByOrganizationId),
)
