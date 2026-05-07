import { HttpServer } from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Effect, Layer } from "effect"
import { createServer } from "node:http"

import { app } from "./http.js"
import { config } from "./config.js"

const ServerLive = NodeHttpServer.layer(() => createServer(), {
  host: "0.0.0.0",
  port: config.port,
})

const Server = HttpServer.serve(app).pipe(
  Layer.provide(ServerLive),
)

Layer.launch(Server).pipe(
  Effect.tap(() => Effect.logInfo(`server listening on :${config.port}`)),
  NodeRuntime.runMain,
)
