import { Headers, HttpRouter, HttpServerRequest } from "@effect/platform"
import { eq } from "drizzle-orm"
import { Effect, Schema } from "effect"
import Stripe from "stripe"

import {
  type BillingInterval,
  getBillableLocationCount,
  getLocationPriceId,
  getStripe,
  hasCoreBillingAccess,
  updateOrganizationFromCheckoutSession,
  updateOrganizationFromSubscription,
  clearOrganizationSubscription,
} from "../../../billing.js"
import { config } from "../../../config.js"
import { db } from "../../../db/index.js"
import { organizations } from "../../../db/schema.js"
import {
  handleAuthorizationError,
  requireOrganizationAccess,
  requireOrganizationAdmin,
} from "../../middleware/organization.js"
import { json } from "../../response.js"

const OrgParams = Schema.Struct({
  id: Schema.String,
})

const CheckoutSessionBody = Schema.Struct({
  billingInterval: Schema.optional(
    Schema.Union(Schema.Literal("monthly"), Schema.Literal("yearly")),
  ),
})

const parseJsonBody = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  HttpServerRequest.schemaBodyJson(schema).pipe(
    Effect.catchAll(() => Effect.succeed({} as A)),
  )

const getOrganizationBillingRow = async (organizationId: string) => {
  const rows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1)

  return rows[0]
}

const buildBillingStatus = async (organizationId: string) => {
  const organization = await getOrganizationBillingRow(organizationId)
  if (!organization) {
    throw new Error("organization not found")
  }

  const billableLocationCount = await getBillableLocationCount(organizationId)

  return {
    stripeCustomerId: organization.stripeCustomerId,
    stripeSubscriptionId: organization.stripeSubscriptionId,
    subscriptionStatus: organization.stripeSubscriptionStatus,
    stripePriceId: organization.stripePriceId,
    billableLocationCount,
    billingQuantity: organization.billingQuantity,
    currentPeriodEnd: organization.billingCurrentPeriodEnd?.toISOString() ?? null,
    accessAllowed: hasCoreBillingAccess(organization.stripeSubscriptionStatus),
  }
}

const getBillingStatus = Effect.gen(function* () {
  const { id: organizationId } = yield* HttpRouter.schemaPathParams(OrgParams)
  const authorized = yield* requireOrganizationAccess(organizationId).pipe(
    Effect.either,
  )
  if (authorized._tag === "Left") {
    return yield* handleAuthorizationError(authorized.left)
  }

  const status = yield* Effect.tryPromise({
    try: () => buildBillingStatus(organizationId),
    catch: () => new Error("failed to load billing status"),
  })

  return yield* json(status)
}).pipe(Effect.catchAll((error) => json({ error: error.message }, 400)))

const createCheckoutSession = Effect.gen(function* () {
  const { id: organizationId } = yield* HttpRouter.schemaPathParams(OrgParams)
  const body = yield* parseJsonBody(CheckoutSessionBody)
  const billingInterval: BillingInterval = body.billingInterval ?? "monthly"
  const authorized = yield* requireOrganizationAdmin(organizationId).pipe(
    Effect.either,
  )
  if (authorized._tag === "Left") {
    return yield* handleAuthorizationError(authorized.left)
  }

  const session = yield* Effect.tryPromise({
    try: async () => {
      const organization = await getOrganizationBillingRow(organizationId)
      if (!organization) {
        throw new Error("organization not found")
      }

      const quantity = Math.max(
        await getBillableLocationCount(organizationId),
        1,
      )
      const locationPriceId = getLocationPriceId(billingInterval)
      const stripe = getStripe()
      let customerId = organization.stripeCustomerId

      if (!customerId) {
        const customer = await stripe.customers.create({
          name: organization.name,
          metadata: { organizationId },
        })
        customerId = customer.id
        await db
          .update(organizations)
          .set({ stripeCustomerId: customerId, updatedAt: new Date() })
          .where(eq(organizations.id, organizationId))
      }

      return stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [
          {
            price: locationPriceId,
            quantity,
          },
        ],
        success_url: `${config.appBaseUrl}/${organization.slug}/settings/billing?checkout=success`,
        cancel_url: `${config.appBaseUrl}/${organization.slug}/settings/billing?checkout=cancel`,
        metadata: {
          organizationId,
          billingModel: "per_location",
          billingInterval,
        },
        subscription_data: {
          metadata: {
            organizationId,
            billingModel: "per_location",
            billingInterval,
          },
        },
      })
    },
    catch: (error) =>
      error instanceof Error
        ? error
        : new Error("failed to create checkout session"),
  })

  return yield* json({ url: session.url })
}).pipe(Effect.catchAll((error) => json({ error: error.message }, 400)))

const createPortalSession = Effect.gen(function* () {
  const { id: organizationId } = yield* HttpRouter.schemaPathParams(OrgParams)
  const authorized = yield* requireOrganizationAdmin(organizationId).pipe(
    Effect.either,
  )
  if (authorized._tag === "Left") {
    return yield* handleAuthorizationError(authorized.left)
  }

  const session = yield* Effect.tryPromise({
    try: async () => {
      const organization = await getOrganizationBillingRow(organizationId)
      if (!organization?.stripeCustomerId) {
        throw new Error("Stripe customer not found")
      }

      return getStripe().billingPortal.sessions.create({
        customer: organization.stripeCustomerId,
        return_url: `${config.appBaseUrl}/${organization.slug}/settings/billing`,
      })
    },
    catch: (error) =>
      error instanceof Error
        ? error
        : new Error("failed to create portal session"),
  })

  return yield* json({ url: session.url })
}).pipe(Effect.catchAll((error) => json({ error: error.message }, 400)))

const stripeWebhook = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest
  const signature = Headers.get(request.headers, "stripe-signature").pipe(
    (option) => (option._tag === "Some" ? option.value : undefined),
  )

  if (!signature) {
    return yield* json({ error: "missing Stripe signature" }, 400)
  }
  if (config.stripe.webhookSecret === "") {
    return yield* json({ error: "STRIPE_WEBHOOK_SECRET is required" }, 500)
  }

  const rawBody = yield* request.arrayBuffer
  const event = yield* Effect.try({
    try: () => {
      const body = Buffer.from(rawBody)
      return getStripe().webhooks.constructEvent(
        body,
        signature,
        config.stripe.webhookSecret,
      )
    },
    catch: () => new Error("invalid webhook signature"),
  })

  yield* Effect.tryPromise({
    try: async () => {
      switch (event.type) {
        case "checkout.session.completed":
          await updateOrganizationFromCheckoutSession(
            event.data.object as Stripe.Checkout.Session,
          )
          break
        case "customer.subscription.created":
        case "customer.subscription.updated":
          await updateOrganizationFromSubscription(
            event.data.object as Stripe.Subscription,
          )
          break
        case "customer.subscription.deleted":
          await clearOrganizationSubscription(
            event.data.object as Stripe.Subscription,
          )
          break
      }
    },
    catch: () => new Error("failed to process webhook"),
  })

  return yield* json({ received: true })
}).pipe(
  Effect.catchAll((error) =>
    json(
      { error: error.message },
      error.message === "invalid webhook signature" ? 400 : 500,
    ),
  ),
)

export const BillingGroupLive = HttpRouter.empty.pipe(
  HttpRouter.get("/organizations/:id/billing/status", getBillingStatus),
  HttpRouter.post(
    "/organizations/:id/billing/checkout-session",
    createCheckoutSession,
  ),
  HttpRouter.post(
    "/organizations/:id/billing/portal-session",
    createPortalSession,
  ),
  HttpRouter.post("/stripe/webhook", stripeWebhook),
)
