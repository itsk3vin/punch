import {
  HttpRouter,
  HttpServerRequest,
} from "@effect/platform"
import { eq } from "drizzle-orm"
import { Effect, Schema } from "effect"

import { db } from "../../db/index.js"
import { organizations } from "../../db/schema.js"
import {
  handleAuthorizationError,
  requireOrganizationAccess,
} from "../middleware/organization.js"
import { json } from "../response.js"

const CreateOrganizationBody = Schema.Struct({
  name: Schema.String,
  slug: Schema.String,
  logoUrl: Schema.optional(Schema.String),
})

const UpdateOrganizationBody = Schema.Struct({
  id: Schema.String,
  name: Schema.optional(Schema.String),
  slug: Schema.optional(Schema.String),
  logoUrl: Schema.optional(Schema.String),
})

const IdPathParams = Schema.Struct({
  id: Schema.String,
})

const parseJsonBody = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  HttpServerRequest.schemaBodyJson(schema).pipe(
    Effect.mapError(() => new Error("invalid request body")),
  )

const getOrganizationFromId = Effect.gen(function* () {
  const { id } = yield* HttpRouter.schemaPathParams(IdPathParams)

  const authorized = yield* requireOrganizationAccess(id).pipe(
    Effect.either,
  )
  if (authorized._tag === "Left") {
    return yield* handleAuthorizationError(authorized.left)
  }

  const results = yield* Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(organizations)
        .where(eq(organizations.id, id))
        .limit(1),
    catch: () => new Error("failed to get organization"),
  })

  if (results.length === 0) {
    return yield* json({ error: "organization not found" }, 404)
  }

  return yield* json(results[0])
})

const createOrganization = Effect.gen(function* () {
  const body = yield* parseJsonBody(CreateOrganizationBody).pipe(
    Effect.catchAll(() => Effect.fail(new Error("invalid request body"))),
  )

  const created = yield* Effect.tryPromise({
    try: () =>
      db
        .insert(organizations)
        .values(body)
        .returning(),
    catch: () => new Error("failed to create organization"),
  })

  return yield* json(created[0], 201)
}).pipe(
  Effect.catchAll((error) => json({ error: error.message }, 400)),
)

const updateOrganization = Effect.gen(function* () {
  const body = yield* parseJsonBody(UpdateOrganizationBody).pipe(
    Effect.catchAll(() => Effect.fail(new Error("invalid request body"))),
  )
  const { id, ...updates } = body

  const updated = yield* Effect.tryPromise({
    try: () =>
      db
        .update(organizations)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, id))
        .returning(),
    catch: () => new Error("failed to update organization"),
  })

  if (updated.length === 0) {
    return yield* json({ error: "organization not found" }, 404)
  }

  return yield* json(updated[0])
}).pipe(
  Effect.catchAll((error) => json({ error: error.message }, 400)),
)

export const OrganizationGroupLive = HttpRouter.empty.pipe(
  HttpRouter.get("/organization/:id", getOrganizationFromId),
  HttpRouter.post("/organization/create", createOrganization),
  HttpRouter.put("/organization/update", updateOrganization),
)
