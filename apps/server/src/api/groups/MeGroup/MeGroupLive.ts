import {
  Headers,
  HttpRouter,
  HttpServerRequest,
} from "@effect/platform"
import {
  and,
  eq,
  isNull,
} from "drizzle-orm"
import { Effect, Schema } from "effect"

import { verifyBearerToken } from "../../../auth.js"
import { fetchEmployeeScopesForMe } from "../../middleware/organization.js"
import { db } from "../../../db/index.js"
import {
  employees,
  invitations,
  organizations,
} from "../../../db/schema.js"
import { getSignedAssetReadUrl } from "../../../r2.js"
import { json } from "../../response.js"

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }
  return typeof error === "string" ? error : JSON.stringify(error)
}

const wrapDbError =
  (label: string) =>
  (error: unknown): Error =>
    new Error(`${label}: ${errorMessage(error)}`)

const EmployeeResponse = Schema.Struct({
  id: Schema.String,
  userId: Schema.String,
  organizationId: Schema.String,
  locationId: Schema.NullOr(Schema.String),
  departmentId: Schema.NullOr(Schema.String),
  email: Schema.String,
  name: Schema.String,
  role: Schema.String,
})

const MeScopeItem = Schema.Union(
  Schema.Struct({
    type: Schema.Literal("location"),
    id: Schema.String,
    name: Schema.String,
  }),
  Schema.Struct({
    type: Schema.Literal("department"),
    id: Schema.String,
    name: Schema.String,
  }),
)

const OrganizationResponse = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  logoUrl: Schema.NullOr(Schema.String),
})

const InvitationSummary = Schema.Struct({
  id: Schema.String,
  organizationId: Schema.String,
  organizationName: Schema.String,
  role: Schema.String,
  email: Schema.String,
})

const UpdateProfileBody = Schema.Struct({
  name: Schema.String,
})

const MeResponse = Schema.Union(
  Schema.Struct({
    status: Schema.Literal("ready"),
    employee: EmployeeResponse,
    organization: OrganizationResponse,
    scopes: Schema.Array(MeScopeItem),
  }),
  Schema.Struct({
    status: Schema.Literal("has_invitations"),
    email: Schema.String,
    invitations: Schema.Array(InvitationSummary),
  }),
  Schema.Struct({
    status: Schema.Literal("needs_organization"),
    email: Schema.String,
  }),
  Schema.Struct({
    status: Schema.Literal("email_unverified"),
    email: Schema.String,
  }),
)

export type MeResponse = Schema.Schema.Type<typeof MeResponse>

const parseJsonBody = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  HttpServerRequest.schemaBodyJson(schema).pipe(
    Effect.mapError(() => new Error("invalid request body")),
  )

const getAuthorizationHeader = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest
  return Headers.get(request.headers, "authorization").pipe((option) =>
    option._tag === "Some" ? option.value : undefined,
  )
})

const getMe = Effect.gen(function* () {
  const authorization = yield* getAuthorizationHeader

  const claims = yield* Effect.tryPromise({
    try: () => verifyBearerToken(authorization),
    catch: () => new Error("unauthorized"),
  })

  const employeeResults = yield* Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(employees)
        .where(eq(employees.userId, claims.sub))
        .limit(1),
    catch: wrapDbError("failed to get employee"),
  })

  const employee = employeeResults[0]
  if (employee?.organizationId) {
    const organizationId = employee.organizationId
    const organizationResults = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(organizations)
          .where(eq(organizations.id, organizationId))
          .limit(1),
      catch: wrapDbError("failed to get organization"),
    })
    const organization = organizationResults[0]

    if (organization) {
      const logoUrl = yield* getSignedAssetReadUrl(organization.logoUrl)

      const scopes = yield* Effect.tryPromise({
        try: () => fetchEmployeeScopesForMe(employee.id),
        catch: wrapDbError("failed to get manager scopes"),
      })

      return yield* json({
        status: "ready",
        employee: {
          id: employee.id,
          userId: employee.userId ?? "",
          organizationId: employee.organizationId,
          locationId: employee.locationId ?? null,
          departmentId: employee.departmentId ?? null,
          email: employee.email,
          name: employee.name,
          role: employee.role,
        },
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          logoUrl,
        },
        scopes,
      } satisfies MeResponse)
    }
  }

  const email = claims.email
  if (!email) {
    return yield* json({
      status: "needs_organization",
      email: "",
    } satisfies MeResponse)
  }

  if (!claims.email_verified) {
    return yield* json({
      status: "email_unverified",
      email,
    } satisfies MeResponse)
  }

  const pendingInvitations = yield* Effect.tryPromise({
    try: () =>
      db
        .select({
          id: invitations.id,
          organizationId: invitations.organizationId,
          organizationName: organizations.name,
          role: invitations.role,
          email: invitations.email,
        })
        .from(invitations)
        .innerJoin(organizations, eq(invitations.organizationId, organizations.id))
        .where(and(
          eq(invitations.email, email),
          isNull(invitations.acceptedAt),
          isNull(invitations.rejectedAt),
        )),
    catch: wrapDbError("failed to get invitations"),
  })

  if (pendingInvitations.length > 0) {
    return yield* json({
      status: "has_invitations",
      email,
      invitations: pendingInvitations.map((invitation) => ({
        id: invitation.id,
        organizationId: invitation.organizationId ?? "",
        organizationName: invitation.organizationName,
        role: invitation.role,
        email: invitation.email,
      })),
    } satisfies MeResponse)
  }

  return yield* json({
    status: "needs_organization",
    email,
  } satisfies MeResponse)
}).pipe(
  Effect.catchAll((error) => {
    const msg = errorMessage(error)
    if (msg !== "unauthorized") {
      console.error("[GET /api/v1/me]", msg)
    }
    const isUnauthorized = msg === "unauthorized"
    const isDbOrInfra =
      msg.startsWith("failed to get employee:") ||
      msg.startsWith("failed to get organization:") ||
      msg.startsWith("failed to get invitations:") ||
      msg.startsWith("failed to get manager scopes:")
    const status = isUnauthorized ? 401 : isDbOrInfra ? 500 : 400
    return json({ error: msg }, status)
  }),
)

const updateProfile = Effect.gen(function* () {
  const body = yield* parseJsonBody(UpdateProfileBody).pipe(
    Effect.catchAll(() => Effect.fail(new Error("invalid request body"))),
  )
  const name = body.name.trim()
  if (name === "") {
    return yield* json({ error: "name is required" }, 400)
  }

  const authorization = yield* getAuthorizationHeader
  const claims = yield* Effect.tryPromise({
    try: () => verifyBearerToken(authorization),
    catch: () => new Error("unauthorized"),
  })

  const updated = yield* Effect.tryPromise({
    try: () =>
      db
        .update(employees)
        .set({
          name,
          updatedAt: new Date(),
        })
        .where(eq(employees.userId, claims.sub))
        .returning(),
    catch: () => new Error("failed to update profile"),
  })

  const employee = updated[0]
  if (!employee) {
    return yield* json({ error: "employee not found" }, 404)
  }

  return yield* json({ name: employee.name })
}).pipe(
  Effect.catchAll((error) =>
    json(
      { error: error.message },
      error.message === "unauthorized" ? 401 : 400,
    )
  ),
)

export const MeGroupLive = HttpRouter.empty.pipe(
  HttpRouter.get("/me", getMe),
  HttpRouter.put("/me/profile", updateProfile),
)
