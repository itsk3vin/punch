import {
  and,
  eq,
  isNull,
} from "drizzle-orm"
import {
  HttpRouter,
  HttpServerRequest,
} from "@effect/platform"
import { Effect, Schema } from "effect"

import { db } from "../../db/index.js"
import { invitations } from "../../db/schema.js"
import {
  handleAuthorizationError,
  requireOrganizationAdmin,
  requireOrganizationAccess,
} from "../middleware/organization.js"
import { json } from "../response.js"

const CreateInvitationBody = Schema.Struct({
  name: Schema.String,
  email: Schema.String,
  role: Schema.optional(Schema.String),
})

const IdPathParams = Schema.Struct({
  id: Schema.String,
})

const parseJsonBody = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  HttpServerRequest.schemaBodyJson(schema).pipe(
    Effect.mapError(() => new Error("invalid request body")),
  )

const listPendingInvitationsByOrganizationId = Effect.gen(function* () {
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
        .from(invitations)
        .where(and(
          eq(invitations.organizationId, organizationId),
          isNull(invitations.acceptedAt),
          isNull(invitations.rejectedAt),
        )),
    catch: () => new Error("failed to list invitations"),
  })

  return yield* json(results)
}).pipe(
  Effect.catchAll((error) =>
    error instanceof Error
      ? json({ error: error.message }, 400)
      : json({ error: "failed to list invitations" }, 400),
  ),
)

const createInvitation = Effect.gen(function* () {
  const { id: organizationId } = yield* HttpRouter.schemaPathParams(IdPathParams)
  const body = yield* parseJsonBody(CreateInvitationBody).pipe(
    Effect.catchAll(() => Effect.fail(new Error("invalid request body"))),
  )

  const authorized = yield* requireOrganizationAdmin(organizationId).pipe(
    Effect.either,
  )
  if (authorized._tag === "Left") {
    return yield* handleAuthorizationError(authorized.left)
  }
  const currentEmployee = authorized.right

  const email = body.email.trim().toLowerCase()
  if (email === "") {
    return yield* json({ error: "email is required" }, 400)
  }
  const name = body.name.trim()
  if (name === "") {
    return yield* json({ error: "name is required" }, 400)
  }

  const created = yield* Effect.tryPromise({
    try: () =>
      db
        .insert(invitations)
        .values({
          organizationId,
          email,
          name,
          role: body.role ?? "employee",
          invitedBy: currentEmployee.id,
        })
        .returning(),
    catch: () => new Error("failed to create invitation"),
  })

  return yield* json(created[0], 201)
}).pipe(
  Effect.catchAll((error) =>
    error instanceof Error
      ? json({ error: error.message }, 400)
      : json({ error: "failed to create invitation" }, 400),
  ),
)

export const InvitationsGroupLive = HttpRouter.empty.pipe(
  HttpRouter.get("/organizations/:id/invitations", listPendingInvitationsByOrganizationId),
  HttpRouter.post("/organizations/:id/invitations", createInvitation),
)
