import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { Effect } from "effect"

import { config } from "./config.js"

const signedUploadTtlSeconds = 60
const signedReadTtlSeconds = 15 * 60

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.r2.accessKeyId,
    secretAccessKey: config.r2.secretAccessKey,
  },
})

const ensureR2Configured = Effect.gen(function* () {
  if (
    !config.r2.accountId ||
    !config.r2.accessKeyId ||
    !config.r2.secretAccessKey ||
    !config.r2.bucket
  ) {
    return yield* Effect.fail(new Error("R2 is not configured"))
  }
})

export const organizationLogoKey = (organizationId: string) =>
  `organizations/${organizationId}/logo/256.png`

export const getSignedOrganizationLogoUploadUrl = (organizationId: string) =>
  Effect.gen(function* () {
    yield* ensureR2Configured

    const key = organizationLogoKey(organizationId)
    const command = new PutObjectCommand({
      Bucket: config.r2.bucket,
      Key: key,
      ContentType: "image/png",
    })

    const uploadUrl = yield* Effect.tryPromise({
      try: () =>
        getSignedUrl(r2Client, command, {
          expiresIn: signedUploadTtlSeconds,
        }),
      catch: () => new Error("failed to create upload url"),
    })

    return {
      key,
      uploadUrl,
      contentType: "image/png",
    }
  })

export const getSignedAssetReadUrl = (key: string | null) =>
  Effect.gen(function* () {
    if (!key) {
      return null
    }

    yield* ensureR2Configured

    const command = new GetObjectCommand({
      Bucket: config.r2.bucket,
      Key: key,
    })

    return yield* Effect.tryPromise({
      try: () =>
        getSignedUrl(r2Client, command, {
          expiresIn: signedReadTtlSeconds,
        }),
      catch: () => new Error("failed to create asset url"),
    })
  }).pipe(
    // R2 often unset locally; signing can also fail transiently. Never block /me on logos.
    Effect.catchAll(() => Effect.succeed(null)),
  )
