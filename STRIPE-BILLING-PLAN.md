# Stripe Billing Integration Plan

## Summary

Integrate Stripe Billing as an organization-level subscription where each organization has one Stripe customer and one Stripe subscription. Pricing is per location, and the Stripe subscription quantity should match the number of locations in the application.

Organizations should enter Checkout after onboarding, once the organization already exists locally. Admins should manage payment methods, invoices, cancellation, and subscription changes through Stripe's hosted Billing Portal. Stripe webhooks should be the source of truth for syncing subscription status and billing metadata back into the local database.

## Server Config and Dependencies

Add the Stripe server SDK to the API server package. Keep Stripe usage server-side only; the web client should never receive or use the Stripe secret key.

Add server configuration for:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_LOCATION_MONTHLY_PRICE_ID`
- `STRIPE_LOCATION_YEARLY_PRICE_ID`
- `APP_BASE_URL`

Use the monthly and yearly location price IDs as the recurring prices for billable locations. Use `APP_BASE_URL` to build Checkout success/cancel URLs and Billing Portal return URLs.

## Database Fields

Add billing metadata to the `organizations` table:

- `stripe_customer_id`
- `stripe_subscription_id`
- `stripe_subscription_status`
- `stripe_price_id`
- `billing_quantity`
- `billing_current_period_end`

The local billing fields should mirror the latest known Stripe state from webhooks. App access should be based on these synced fields, not on client-provided data.

## Billing API Endpoints

Add authenticated organization billing endpoints under `/api/v1/organizations/:id/billing`.

`GET /status`

- Requires organization access.
- Returns the organization's billing status, current billable location count, synced billing quantity, current period end, and whether core app access is allowed.

`POST /checkout-session`

- Requires organization admin access.
- Creates or reuses the organization's Stripe customer.
- Creates a Stripe Checkout Session in subscription mode.
- Accepts `billingInterval: "monthly" | "yearly"` and defaults to monthly.
- Uses the matching per-location price with quantity equal to the current number of locations.
- Includes `organizationId`, `billingModel: "per_location"`, and `billingInterval` metadata on the Checkout Session.
- Returns the Checkout URL for the web client to redirect to.

`POST /portal-session`

- Requires organization admin access.
- Requires an existing Stripe customer.
- Creates a Stripe Billing Portal Session.
- Returns the Portal URL for the web client to redirect to.

## Stripe Webhook Handling

Add an unauthenticated webhook endpoint:

`POST /api/v1/stripe/webhook`

The endpoint must verify the Stripe signature using the raw request body and `STRIPE_WEBHOOK_SECRET` before processing any event.

Handle at minimum:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Webhook processing should be idempotent. For subscription events, find the organization by Stripe customer ID or metadata and update the local billing fields with the latest subscription ID, status, price ID, quantity, and current period end.

## App Access Enforcement

Treat subscription statuses `active` and `trialing` as allowing core app access.

For all other statuses, restrict core app features:

- Admins can still access billing settings and billing recovery actions.
- Non-admin users should see a restricted-access state rather than normal scheduling/settings screens.
- Server-side write endpoints for core product features should enforce billing access, not only the web UI.

## Location Quantity Sync

Every row in `locations` is billable.

When a location is created for an organization with an existing Stripe subscription, update the Stripe subscription item quantity to the organization's current total location count. After Stripe confirms the update, mirror the new quantity locally through webhook sync or a successful server-side update.

Because every location is billable, do not add an active/archive location state for this integration.

## Billing Settings UI

Update the existing billing settings page for organization admins.

The page should show:

- Subscription status
- Current billable location count
- Synced Stripe billing quantity
- Current period end or renewal date when available
- A "Start subscription" action when no subscription exists
- A "Manage billing" action when a Stripe customer or subscription exists

The "Start subscription" action should call the Checkout Session endpoint and redirect to Stripe Checkout. The "Manage billing" action should call the Portal Session endpoint and redirect to the Stripe Billing Portal.

Handle Checkout success and cancel returns by bringing the admin back to the billing settings page and reloading billing status.

## Test Plan

Run server typechecking:

```sh
pnpm --filter server check-types
```

Run web typechecking:

```sh
pnpm --filter web check-types
```

Verify Stripe test-mode Checkout:

- Admin can create a Checkout Session.
- Checkout uses the per-location recurring price.
- Checkout quantity equals the organization's current location count.
- Checkout completion returns to the app.

Verify webhook behavior:

- Invalid webhook signatures are rejected.
- `checkout.session.completed` links the Stripe customer/subscription to the organization.
- Subscription create/update/delete events update local billing fields idempotently.

Verify quantity sync:

- Creating a new location for a subscribed organization updates the Stripe subscription quantity.
- Local billing quantity reflects the latest Stripe quantity after sync.

Verify access restriction:

- Organizations with `active` or `trialing` subscriptions can use core app features.
- Past-due, canceled, incomplete, or missing subscriptions restrict core app access.
- Admins can still access billing settings and recovery actions.

## Assumptions

- Billing is per organization, not per user.
- Every `locations` row is billable.
- Checkout happens after organization creation/onboarding.
- Stripe-hosted Checkout and Billing Portal are preferred over custom payment UI.
- Subscription statuses `active` and `trialing` allow core app access.
- Admins can always access billing recovery flows.
