import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose"

import { auth0Issuer, config } from "./config.js"

export type AuthClaims = JWTPayload & {
  sub: string
}

const issuer = auth0Issuer(config.auth0.domain)
const jwks =
  config.auth0.domain === "" ? undefined : createRemoteJWKSet(new URL(".well-known/jwks.json", issuer))

export async function verifyBearerToken(authorization: string | undefined) {
  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("missing bearer token")
  }

  if (!jwks || config.auth0.audience === "") {
    throw new Error("AUTH0_DOMAIN and AUTH0_AUDIENCE must be set")
  }

  const token = authorization.slice("Bearer ".length).trim()
  if (token === "") {
    throw new Error("missing bearer token")
  }

  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    audience: config.auth0.audience,
  })

  if (!payload.sub) {
    throw new Error("invalid token claims")
  }

  return payload as AuthClaims
}
