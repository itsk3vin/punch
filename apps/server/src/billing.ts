import { and, eq, sql } from "drizzle-orm"
import Stripe from "stripe"

import { config } from "./config.js"
import { db } from "./db/index.js"
import { locations, organizations } from "./db/schema.js"

const BILLING_ALLOWED_STATUSES = new Set(["active", "trialing"])

export type BillingInterval = "monthly" | "yearly"

let stripeClient: Stripe | undefined

function requireStripeConfig() {
  if (config.stripe.secretKey === "") {
    throw new Error("STRIPE_SECRET_KEY is required")
  }
  if (config.stripe.locationMonthlyPriceId === "") {
    throw new Error("STRIPE_LOCATION_MONTHLY_PRICE_ID is required")
  }
  if (config.stripe.locationYearlyPriceId === "") {
    throw new Error("STRIPE_LOCATION_YEARLY_PRICE_ID is required")
  }
}

export function getStripe() {
  requireStripeConfig()
  stripeClient ??= new Stripe(config.stripe.secretKey)
  return stripeClient
}

export function hasCoreBillingAccess(status: string | null | undefined) {
  return BILLING_ALLOWED_STATUSES.has(status ?? "")
}

export function getLocationPriceId(interval: BillingInterval) {
  return interval === "monthly"
    ? config.stripe.locationMonthlyPriceId
    : config.stripe.locationYearlyPriceId
}

export async function getBillableLocationCount(organizationId: string) {
  const rows = await db
    .select({ count: sql<number>`count(*)::int`.as("count") })
    .from(locations)
    .where(eq(locations.organizationId, organizationId))

  return rows[0]?.count ?? 0
}

export async function updateOrganizationFromSubscription(
  subscription: Stripe.Subscription,
) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id
  const item = subscription.items.data[0]
  const metadataOrganizationId = subscription.metadata.organizationId
  const currentPeriodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000)
    : null

  const where =
    metadataOrganizationId && metadataOrganizationId.length > 0
      ? eq(organizations.id, metadataOrganizationId)
      : eq(organizations.stripeCustomerId, customerId)

  await db
    .update(organizations)
    .set({
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripeSubscriptionStatus: subscription.status,
      stripePriceId: item?.price.id ?? null,
      billingQuantity: item?.quantity ?? null,
      billingCurrentPeriodEnd: currentPeriodEnd,
      updatedAt: new Date(),
    })
    .where(where)
}

export async function updateOrganizationFromCheckoutSession(
  session: Stripe.Checkout.Session,
) {
  const organizationId = session.metadata?.organizationId
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id

  if (!organizationId || !customerId) {
    return
  }

  if (subscriptionId) {
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId)
    await updateOrganizationFromSubscription(subscription)
    return
  }

  await db
    .update(organizations)
    .set({
      stripeCustomerId: customerId,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId))
}

export async function clearOrganizationSubscription(
  subscription: Stripe.Subscription,
) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id

  await db
    .update(organizations)
    .set({
      stripeSubscriptionId: subscription.id,
      stripeSubscriptionStatus: subscription.status,
      stripePriceId: subscription.items.data[0]?.price.id ?? null,
      billingQuantity: subscription.items.data[0]?.quantity ?? null,
      billingCurrentPeriodEnd: subscription.items.data[0]?.current_period_end
        ? new Date(subscription.items.data[0].current_period_end * 1000)
        : null,
      updatedAt: new Date(),
    })
    .where(eq(organizations.stripeCustomerId, customerId))
}

export async function syncSubscriptionQuantityForOrganization(
  organizationId: string,
) {
  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1)

  if (!organization?.stripeSubscriptionId) {
    return
  }

  const quantity = await getBillableLocationCount(organizationId)
  const stripe = getStripe()
  const subscription = await stripe.subscriptions.retrieve(
    organization.stripeSubscriptionId,
  )
  const item = subscription.items.data.find(
    (subscriptionItem) =>
      subscriptionItem.price.id ===
      (organization.stripePriceId ?? getLocationPriceId("monthly")),
  ) ?? subscription.items.data[0]

  if (!item) {
    throw new Error("subscription item not found")
  }

  await stripe.subscriptionItems.update(item.id, {
    quantity,
    proration_behavior: "create_prorations",
  })

  await db
    .update(organizations)
    .set({
      billingQuantity: quantity,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(organizations.id, organizationId),
        eq(organizations.stripeSubscriptionId, organization.stripeSubscriptionId),
      ),
    )
}
