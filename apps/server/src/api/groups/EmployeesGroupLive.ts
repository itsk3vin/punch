import {
  HttpRouter,
  HttpServerRequest,
} from "@effect/platform"
import { eq } from "drizzle-orm"
import { Effect, Schema } from "effect"

import { db } from "../../db/index.js"
import { employees } from "../../db/schema.js"
import { json } from "../response.js"

const CreateEmployeeBody = Schema.Struct({
  userId: Schema.optional(Schema.String),
  organizationId: Schema.optional(Schema.String),
  email: Schema.String,
  name: Schema.String,
  role: Schema.optional(Schema.String),
})

const UpdateEmployeeBody = Schema.Struct({
  id: Schema.String,
  userId: Schema.optional(Schema.String),
  organizationId: Schema.optional(Schema.String),
  email: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  role: Schema.optional(Schema.String),
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

  if (results.length === 0) {
    return yield* json({ error: "employee not found" }, 404)
  }

  return yield* json(results[0])
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
  const body = yield* parseJsonBody(UpdateEmployeeBody).pipe(
    Effect.catchAll(() => Effect.fail(new Error("invalid request body"))),
  )
  const { id, ...updates } = body

  const updated = yield* Effect.tryPromise({
    try: () =>
      db
        .update(employees)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
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

const getAllEmployeesByOrganizationId = Effect.gen(function* () {
  const { id: organizationId } = yield* HttpRouter.schemaPathParams(IdPathParams)

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
  HttpRouter.get("/employees/org/:id", getAllEmployeesByOrganizationId),
)
