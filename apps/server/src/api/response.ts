import { HttpServerResponse } from "@effect/platform"

export const json = (body: unknown, status = 200) =>
  HttpServerResponse.unsafeJson(body, {
    status,
    headers: {
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Origin": "*",
    },
  })
