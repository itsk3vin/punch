import {
  HttpRouter,
  HttpServerRequest,
} from "@effect/platform"
import { eq } from "drizzle-orm"
import { Effect, Schema } from "effect"

import { verifyBearerToken } from "../../auth.js"
import { db } from "../../db/index.js"
import { employees } from "../../db/schema.js"
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

export const requirePathOrganizationAccess = Effect.gen(function* () {
  const { id: organizationId } = yield* HttpRouter.schemaPathParams(Schema.Struct({
    id: Schema.String,
  }))

  return yield* requireOrganizationAccess(organizationId)
}).pipe(
  Effect.catchAll(authorizationError),
)

export const handleAuthorizationError = authorizationError
