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

import { verifyBearerToken } from "../../auth.js"
import { db } from "../../db/index.js"
import {
  employees,
  invitations,
  organizations,
} from "../../db/schema.js"
import { json } from "../response.js"

const EmployeeResponse = Schema.Struct({
  id: Schema.String,
  userId: Schema.String,
  organizationId: Schema.String,
  email: Schema.String,
  name: Schema.String,
  role: Schema.String,
})

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

const MeResponse = Schema.Union(
  Schema.Struct({
    status: Schema.Literal("ready"),
    employee: EmployeeResponse,
    organization: OrganizationResponse,
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

const getMe = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest
  const authorization = Headers.get(request.headers, "authorization").pipe(
    (option) => option._tag === "Some" ? option.value : undefined,
  )

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
    catch: () => new Error("failed to get employee"),
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
      catch: () => new Error("failed to get organization"),
    })
    const organization = organizationResults[0]

    if (organization) {
      return yield* json({
        status: "ready",
        employee: {
          id: employee.id,
          userId: employee.userId ?? "",
          organizationId: employee.organizationId,
          email: employee.email,
          name: employee.name,
          role: employee.role,
        },
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          logoUrl: organization.logoUrl,
        },
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
    catch: () => new Error("failed to get invitations"),
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
  Effect.catchAll((error) =>
    json({ error: error.message }, error.message === "unauthorized" ? 401 : 400)
  ),
)

export const MeGroupLive = HttpRouter.empty.pipe(
  HttpRouter.get("/me", getMe),
)
