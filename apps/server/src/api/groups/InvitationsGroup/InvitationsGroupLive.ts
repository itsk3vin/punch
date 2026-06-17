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
import {
  departments,
  invitations,
  locations,
} from "../../db/schema.js"
import {
  handleAuthorizationError,
  requireInvitationAuthority,
  requireOrganizationAccess,
} from "../middleware/organization.js"
import {
  getOrganizationalVisibility,
  invitationMatchesVisibilityResolved,
} from "../middleware/resourceScope.js"
import { json } from "../response.js"

const CreateInvitationBody = Schema.Struct({
  name: Schema.String,
  email: Schema.String,
  role: Schema.optional(Schema.String),
  locationId: Schema.optional(Schema.Union(Schema.Null, Schema.String)),
  departmentId: Schema.optional(Schema.Union(Schema.Null, Schema.String)),
})

const IdPathParams = Schema.Struct({
  id: Schema.String,
})

const parseJsonBody = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  HttpServerRequest.schemaBodyJson(schema).pipe(
    Effect.mapError(() => new Error("invalid request body")),
  )

const OrgInvitationPathParams = Schema.Struct({
  id: Schema.String,
  invitationId: Schema.String,
})

const listPendingInvitationsByOrganizationId = Effect.gen(function* () {
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
        .from(invitations)
        .where(and(
          eq(invitations.organizationId, organizationId),
          isNull(invitations.acceptedAt),
          isNull(invitations.rejectedAt),
        )),
    catch: () => new Error("failed to list invitations"),
  })

  if (visibility.kind === "all") {
    return yield* json(results)
  }

  const filtered = yield* Effect.tryPromise({
    try: async () => {
      const out: typeof results = []
      for (const inv of results) {
        if (await invitationMatchesVisibilityResolved(visibility, inv)) {
          out.push(inv)
        }
      }
      return out
    },
    catch: () => new Error("failed to filter invitations"),
  })

  return yield* json(filtered)
}).pipe(
  Effect.catchAll((error) =>
    error instanceof Error
      ? json({ error: error.message }, 400)
      : json({ error: "failed to list invitations" }, 400),
  ),
)

async function resolveInvitationLocationFields(
  organizationId: string,
  locationInput: string | null | undefined,
  departmentInput: string | null | undefined,
): Promise<
  | { ok: false; error: string }
  | {
      ok: true
      locationId: string | null
      departmentId: string | null
    }
> {
  let resolvedLocationId: string | null = null
  let resolvedDepartmentId: string | null = null

  if (departmentInput) {
    const deptRows = await db
      .select({
        dept: departments,
        loc: locations,
      })
      .from(departments)
      .innerJoin(locations, eq(departments.locationId, locations.id))
      .where(and(
        eq(departments.id, departmentInput),
        eq(locations.organizationId, organizationId),
      ))
      .limit(1)

    const row = deptRows[0]
    if (!row) {
      return { ok: false, error: "department not found" }
    }

    resolvedDepartmentId = row.dept.id
    resolvedLocationId = row.loc.id

    if (
      locationInput !== null &&
      locationInput !== undefined &&
      locationInput !== resolvedLocationId
    ) {
      return { ok: false, error: "location does not match department" }
    }
    return {
      ok: true,
      locationId: resolvedLocationId,
      departmentId: resolvedDepartmentId,
    }
  }

  if (locationInput) {
    const locRows = await db
      .select()
      .from(locations)
      .where(and(
        eq(locations.id, locationInput),
        eq(locations.organizationId, organizationId),
      ))
      .limit(1)
    if (!locRows[0]) {
      return { ok: false, error: "location not found" }
    }
    resolvedLocationId = locRows[0].id
  }

  return {
    ok: true,
    locationId: resolvedLocationId,
    departmentId: resolvedDepartmentId,
  }
}

const createInvitation = Effect.gen(function* () {
  const { id: organizationId } = yield* HttpRouter.schemaPathParams(IdPathParams)
  const body = yield* parseJsonBody(CreateInvitationBody).pipe(
    Effect.catchAll(() => Effect.fail(new Error("invalid request body"))),
  )

  const authorized = yield* requireOrganizationAccess(organizationId).pipe(
    Effect.either,
  )
  if (authorized._tag === "Left") {
    return yield* handleAuthorizationError(authorized.left)
  }
  const currentEmployee = authorized.right

  const roleNormalized = body.role ?? "employee"
  if (
    currentEmployee.role !== "admin" &&
    currentEmployee.role !== "manager"
  ) {
    return yield* json({ error: "forbidden" }, 403)
  }

  const email = body.email.trim().toLowerCase()
  if (email === "") {
    return yield* json({ error: "email is required" }, 400)
  }
  const name = body.name.trim()
  if (name === "") {
    return yield* json({ error: "name is required" }, 400)
  }

  const locationInputRaw = body.locationId
  const locationInput =
    locationInputRaw === null || locationInputRaw === undefined
      ? undefined
      : locationInputRaw
  const departmentInputRaw = body.departmentId
  const departmentInput =
    departmentInputRaw === null || departmentInputRaw === undefined
      ? undefined
      : departmentInputRaw

  if (
    currentEmployee.role === "manager" &&
    !departmentInput &&
    !locationInput
  ) {
    return yield* json({ error: "invites must target a location or department" }, 400)
  }

  if (
    roleNormalized === "manager" &&
    !departmentInput &&
    !locationInput &&
    currentEmployee.role !== "admin"
  ) {
    return yield* json({ error: "manager invitations require scope" }, 400)
  }

  const resolvedPayload = yield* Effect.tryPromise({
    try: () =>
      resolveInvitationLocationFields(
        organizationId,
        locationInput,
        departmentInput,
      ),
    catch: () => ({ ok: false as const, error: "failed to resolve invitation scope" }),
  })

  if (!resolvedPayload.ok) {
    return yield* json({ error: resolvedPayload.error }, 400)
  }

  const { locationId, departmentId } = resolvedPayload

  if (currentEmployee.role === "admin") {
    /** allowed */
  } else {
    const auth = yield* requireInvitationAuthority(
      organizationId,
      locationId ?? undefined,
      departmentId ?? undefined,
    ).pipe(Effect.either)
    if (auth._tag === "Left") {
      return yield* handleAuthorizationError(auth.left)
    }
  }

  const created = yield* Effect.tryPromise({
    try: () =>
      db
        .insert(invitations)
        .values({
          organizationId,
          email,
          name,
          role: roleNormalized,
          locationId,
          departmentId,
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

const resendInvitation = Effect.gen(function* () {
  const { id: organizationId, invitationId } =
    yield* HttpRouter.schemaPathParams(OrgInvitationPathParams)

  const access = yield* requireOrganizationAccess(organizationId).pipe(
    Effect.either,
  )
  if (access._tag === "Left") {
    return yield* handleAuthorizationError(access.left)
  }

  const invRows = yield* Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(invitations)
        .where(and(
          eq(invitations.id, invitationId),
          eq(invitations.organizationId, organizationId),
        ))
        .limit(1),
    catch: () => new Error("failed to resolve invitation"),
  })

  const targetInvitation = invRows[0]
  if (!targetInvitation) {
    return yield* json({ error: "invitation not found" }, 404)
  }

  if (access.right.role !== "admin") {
    const auth = yield* requireInvitationAuthority(
      organizationId,
      targetInvitation.locationId ?? undefined,
      targetInvitation.departmentId ?? undefined,
    ).pipe(Effect.either)
    if (auth._tag === "Left") {
      return yield* handleAuthorizationError(auth.left)
    }
  }

  const updated = yield* Effect.tryPromise({
    try: () =>
      db
        .update(invitations)
        .set({
          updatedAt: new Date(),
        })
        .where(and(
          eq(invitations.id, invitationId),
          eq(invitations.organizationId, organizationId),
          isNull(invitations.acceptedAt),
          isNull(invitations.rejectedAt),
        ))
        .returning(),
    catch: () => new Error("failed to resend invitation"),
  })

  if (updated.length === 0) {
    return yield* json({ error: "invitation not found" }, 404)
  }

  return yield* json(updated[0])
}).pipe(
  Effect.catchAll((error) =>
    error instanceof Error
      ? json({ error: error.message }, 400)
      : json({ error: "failed to resend invitation" }, 400),
  ),
)

const revokeInvitation = Effect.gen(function* () {
  const { id: organizationId, invitationId } =
    yield* HttpRouter.schemaPathParams(OrgInvitationPathParams)

  const access = yield* requireOrganizationAccess(organizationId).pipe(
    Effect.either,
  )
  if (access._tag === "Left") {
    return yield* handleAuthorizationError(access.left)
  }

  const invRows = yield* Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(invitations)
        .where(and(
          eq(invitations.id, invitationId),
          eq(invitations.organizationId, organizationId),
        ))
        .limit(1),
    catch: () => new Error("failed to resolve invitation"),
  })

  const targetInvitation = invRows[0]
  if (!targetInvitation) {
    return yield* json({ error: "invitation not found" }, 404)
  }

  if (access.right.role !== "admin") {
    const auth = yield* requireInvitationAuthority(
      organizationId,
      targetInvitation.locationId ?? undefined,
      targetInvitation.departmentId ?? undefined,
    ).pipe(Effect.either)
    if (auth._tag === "Left") {
      return yield* handleAuthorizationError(auth.left)
    }
  }

  const updated = yield* Effect.tryPromise({
    try: () =>
      db
        .update(invitations)
        .set({
          rejectedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(
          eq(invitations.id, invitationId),
          eq(invitations.organizationId, organizationId),
          isNull(invitations.acceptedAt),
          isNull(invitations.rejectedAt),
        ))
        .returning(),
    catch: () => new Error("failed to revoke invitation"),
  })

  if (updated.length === 0) {
    return yield* json({ error: "invitation not found" }, 404)
  }

  return yield* json(updated[0])
}).pipe(
  Effect.catchAll((error) =>
    error instanceof Error
      ? json({ error: error.message }, 400)
      : json({ error: "failed to revoke invitation" }, 400),
  ),
)

export const InvitationsGroupLive = HttpRouter.empty.pipe(
  HttpRouter.get("/organizations/:id/invitations", listPendingInvitationsByOrganizationId),
  HttpRouter.post(
    "/organizations/:id/invitations/:invitationId/resend",
    resendInvitation,
  ),
  HttpRouter.post(
    "/organizations/:id/invitations/:invitationId/revoke",
    revokeInvitation,
  ),
  HttpRouter.post("/organizations/:id/invitations", createInvitation),
)
