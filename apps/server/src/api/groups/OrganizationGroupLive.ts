import { Headers, HttpRouter, HttpServerRequest } from "@effect/platform"
import { eq } from "drizzle-orm"
import { Effect, Schema } from "effect"
import { verifyBearerToken } from "../../auth.js"
import { db } from "../../db/index.js"
import { employees, organizations } from "../../db/schema.js"
import {
  getSignedAssetReadUrl,
  getSignedOrganizationLogoUploadUrl,
} from "../../r2.js"
import {
  handleAuthorizationError,
  requireOrganizationAccess,
} from "../middleware/organization.js"
import { json } from "../response.js"

const CreateOrganizationBody = Schema.Struct({
  name: Schema.String,
  slug: Schema.optional(Schema.String),
  userEmail: Schema.optional(Schema.String),
  userName: Schema.optional(Schema.String),
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

const signOrganizationLogo = <T extends { logoUrl: string | null }>(
  organization: T,
) =>
  Effect.gen(function* () {
    const logoUrl = yield* getSignedAssetReadUrl(organization.logoUrl)
    return {
      ...organization,
      logoUrl,
    }
  })

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

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

const getOrganizationFromId = Effect.gen(function* () {
  const { id } = yield* HttpRouter.schemaPathParams(IdPathParams)

  const authorized = yield* requireOrganizationAccess(id).pipe(Effect.either)
  if (authorized._tag === "Left") {
    return yield* handleAuthorizationError(authorized.left)
  }

  const results = yield* Effect.tryPromise({
    try: () =>
      db.select().from(organizations).where(eq(organizations.id, id)).limit(1),
    catch: () => new Error("failed to get organization"),
  })

  const result = results[0]
  if (!result) {
    return yield* json({ error: "organization not found" }, 404)
  }

  const organization = yield* signOrganizationLogo(result)

  return yield* json(organization)
})

const createOrganizationLogoUploadUrl = Effect.gen(function* () {
  const { id } = yield* HttpRouter.schemaPathParams(IdPathParams)

  const authorized = yield* requireOrganizationAccess(id).pipe(Effect.either)
  if (authorized._tag === "Left") {
    return yield* handleAuthorizationError(authorized.left)
  }

  const upload = yield* getSignedOrganizationLogoUploadUrl(id)

  return yield* json(upload)
}).pipe(Effect.catchAll((error) => json({ error: error.message }, 400)))

const createOrganization = Effect.gen(function* () {
  const body = yield* parseJsonBody(CreateOrganizationBody).pipe(
    Effect.catchAll(() => Effect.fail(new Error("invalid request body"))),
  )
  const authorization = yield* getAuthorizationHeader
  const claims = yield* Effect.tryPromise({
    try: () => verifyBearerToken(authorization),
    catch: () => new Error("unauthorized"),
  })

  const userEmail = claims.email ?? body.userEmail
  const userName = claims.name ?? body.userName ?? userEmail

  if (!userEmail) {
    return yield* json({ error: "email is required" }, 400)
  }
  const adminEmail = userEmail
  const adminName = userName ?? userEmail

  const created = yield* Effect.tryPromise({
    try: () =>
      db.transaction(async (tx) => {
        const [organization] = await tx
          .insert(organizations)
          .values({
            name: body.name,
            slug: body.slug ?? slugify(body.name),
          })
          .returning()

        if (!organization) {
          throw new Error("failed to create organization")
        }

        await tx.insert(employees).values({
          userId: claims.sub,
          organizationId: organization.id,
          email: adminEmail,
          name: adminName,
          role: "admin",
        })

        return organization
      }),
    catch: () => new Error("failed to create organization"),
  })

  return yield* json(created, 201)
}).pipe(
  Effect.catchAll((error) =>
    json(
      { error: error.message },
      error.message === "unauthorized" ? 401 : 400,
    ),
  ),
)

const updateOrganization = Effect.gen(function* () {
  const body = yield* parseJsonBody(UpdateOrganizationBody).pipe(
    Effect.catchAll(() => Effect.fail(new Error("invalid request body"))),
  )
  const { id, ...updates } = body

  const authorized = yield* requireOrganizationAccess(id).pipe(Effect.either)
  if (authorized._tag === "Left") {
    return yield* handleAuthorizationError(authorized.left)
  }

  if (updates.logoUrl && !updates.logoUrl.startsWith(`organizations/${id}/`)) {
    return yield* json({ error: "invalid logo key" }, 400)
  }

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

  const result = updated[0]
  if (!result) {
    return yield* json({ error: "organization not found" }, 404)
  }

  const organization = yield* signOrganizationLogo(result)

  return yield* json(organization)
}).pipe(Effect.catchAll((error) => json({ error: error.message }, 400)))

export const OrganizationGroupLive = HttpRouter.empty.pipe(
  HttpRouter.get("/organization/:id", getOrganizationFromId),
  HttpRouter.post("/organization/create", createOrganization),
  HttpRouter.post(
    "/organization/:id/logo/upload-url",
    createOrganizationLogoUploadUrl,
  ),
  HttpRouter.put("/organization/update", updateOrganization),
)
