import {
  HttpRouter,
  HttpServerRequest,
} from "@effect/platform"
import { Effect } from "effect"

import {
  EmployeesGroupLive,
  InvitationsGroupLive,
  MeGroupLive,
  OrganizationGroupLive,
  ScopedResourcesGroupLive,
} from "./api/groups/index.js"
import { json } from "./api/response.js"

const health = Effect.gen(function* () {
  return yield* json({
    status: "ok",
    time: new Date().toISOString(),
  })
})


export const app = HttpRouter.empty.pipe(
  HttpRouter.options("*", Effect.succeed(json({}))),
  HttpRouter.get("/health", health),
  HttpRouter.mount("/api/v1", EmployeesGroupLive),
  HttpRouter.mount("/api/v1", InvitationsGroupLive),
  HttpRouter.mount("/api/v1", MeGroupLive),
  HttpRouter.mount("/api/v1", OrganizationGroupLive),
  HttpRouter.mount("/api/v1", ScopedResourcesGroupLive),
)
