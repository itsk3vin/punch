import {
  HttpRouter,
  HttpServerRequest,
} from "@effect/platform"
import { Effect } from "effect"

import { EmployeesGroupLive } from "./api/groups/index.js"
import { json } from "./api/response.js"
import { verifyBearerToken } from "./auth.js"

const health = Effect.gen(function* () {
  return yield* json({
    status: "ok",
    time: new Date().toISOString(),
  })
})

const privateRoute = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest
  return yield* Effect.tryPromise({
    try: () => verifyBearerToken(request.headers.authorization),
    catch: () => new Error("invalid bearer token"),
  }).pipe(
    Effect.match({
      onFailure: () => json({ error: "invalid bearer token" }, 401),
      onSuccess: (claims) =>
        json({
          message: "You called a protected endpoint.",
          subject: claims.sub,
        }),
    }),
  )
})

export const app = HttpRouter.empty.pipe(
  HttpRouter.options("*", Effect.succeed(json({}))),
  HttpRouter.get("/health", health),
  HttpRouter.get("/api/v1/private", privateRoute),
  HttpRouter.mount("/api/v1", EmployeesGroupLive),
)
