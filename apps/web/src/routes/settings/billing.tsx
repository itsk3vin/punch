import { useAuth0 } from "@auth0/auth0-react";
import { IconCreditCard, IconExternalLink } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEmployee } from "@/hooks/use-employee";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

type BillingInterval = "monthly" | "yearly";

type BillingStatus = {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  stripePriceId: string | null;
  billableLocationCount: number;
  billingQuantity: number | null;
  currentPeriodEnd: string | null;
  accessAllowed: boolean;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function SettingsBillingRoute() {
  const { orgname } = useParams();
  const [searchParams] = useSearchParams();
  const { getAccessTokenSilently } = useAuth0();
  const { employee, organization, isLoading } = useEmployee();
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBillingLoading, setIsBillingLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "checkout" | "portal" | null
  >(null);
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("monthly");

  const loadBillingStatus = useCallback(async () => {
    if (!organization) {
      return;
    }

    setIsBillingLoading(true);
    setError(null);
    try {
      const accessToken = await getAccessTokenSilently();
      const response = await fetch(
        `${apiBaseUrl}/api/v1/organizations/${organization.id}/billing/status`,
        {
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: unknown;
        } | null;
        throw new Error(String(body?.error ?? "failed to load billing status"));
      }

      setBillingStatus((await response.json()) as BillingStatus);
    } catch (unknownError) {
      setError(
        unknownError instanceof Error
          ? unknownError.message
          : "failed to load billing status",
      );
    } finally {
      setIsBillingLoading(false);
    }
  }, [getAccessTokenSilently, organization]);

  useEffect(() => {
    void loadBillingStatus();
  }, [loadBillingStatus, searchParams]);

  async function redirectToBilling(action: "checkout" | "portal") {
    if (!organization) {
      return;
    }

    setPendingAction(action);
    setError(null);
    try {
      const accessToken = await getAccessTokenSilently();
      const response = await fetch(
        `${apiBaseUrl}/api/v1/organizations/${organization.id}/billing/${
          action === "checkout" ? "checkout-session" : "portal-session"
        }`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${accessToken}`,
            ...(action === "checkout"
              ? { "content-type": "application/json" }
              : {}),
          },
          body:
            action === "checkout"
              ? JSON.stringify({ billingInterval })
              : undefined,
        },
      );

      const body = (await response.json().catch(() => null)) as {
        url?: unknown;
        error?: unknown;
      } | null;

      if (!response.ok || typeof body?.url !== "string") {
        throw new Error(String(body?.error ?? "failed to start billing flow"));
      }

      window.location.assign(body.url);
    } catch (unknownError) {
      setError(
        unknownError instanceof Error
          ? unknownError.message
          : "failed to start billing flow",
      );
      setPendingAction(null);
    }
  }

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">Loading…</div>
    );
  }

  if (!employee || employee.role !== "admin") {
    return (
      <Navigate to={`/${orgname ?? ""}/settings/profile`} replace />
    );
  }

  return (
    <section className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your subscription and payment methods.
        </p>
      </div>

      {searchParams.get("checkout") === "success" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Checkout completed. Stripe will update subscription status shortly.
        </div>
      )}
      {searchParams.get("checkout") === "cancel" && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Checkout was canceled. You can restart when you are ready.
        </div>
      )}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-md border bg-background">
        <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <IconCreditCard className="size-4 text-muted-foreground" />
              <h2 className="text-base font-medium">Subscription</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Billed per location through Stripe.
            </p>
          </div>
          <Badge variant={billingStatus?.accessAllowed ? "default" : "outline"}>
            {billingStatus?.subscriptionStatus ?? "Not started"}
          </Badge>
        </div>

        <dl className="grid gap-px bg-border sm:grid-cols-2">
          {[
            ["Billable locations", billingStatus?.billableLocationCount ?? "—"],
            ["Stripe quantity", billingStatus?.billingQuantity ?? "—"],
            ["Current period end", formatDate(billingStatus?.currentPeriodEnd ?? null)],
            [
              "App access",
              billingStatus?.accessAllowed ? "Allowed" : "Restricted",
            ],
          ].map(([label, value]) => (
            <div key={label} className="bg-background p-5">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-sm font-medium">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap gap-3 p-5">
          {!billingStatus?.stripeSubscriptionId && (
            <div className="flex w-full flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {(["monthly", "yearly"] as const).map((interval) => (
                  <button
                    key={interval}
                    type="button"
                    disabled={pendingAction !== null}
                    onClick={() => setBillingInterval(interval)}
                    className={`rounded-md border p-4 text-left transition-colors ${
                      billingInterval === interval
                        ? "border-primary bg-primary/5"
                        : "bg-background hover:bg-muted/50"
                    }`}
                  >
                    <div className="text-sm font-medium capitalize">
                      {interval}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Billed{" "}
                      {interval === "monthly" ? "month to month" : "once per year"}{" "}
                      per location.
                    </div>
                  </button>
                ))}
              </div>
              <Button
                type="button"
                className="w-fit"
                disabled={isBillingLoading || pendingAction !== null}
                onClick={() => void redirectToBilling("checkout")}
              >
                <IconExternalLink />
                {pendingAction === "checkout"
                  ? "Opening…"
                  : `Start ${billingInterval} subscription`}
              </Button>
            </div>
          )}
          {(billingStatus?.stripeCustomerId ||
            billingStatus?.stripeSubscriptionId) && (
            <Button
              type="button"
              variant="outline"
              disabled={isBillingLoading || pendingAction !== null}
              onClick={() => void redirectToBilling("portal")}
            >
              <IconExternalLink />
              {pendingAction === "portal" ? "Opening…" : "Manage billing"}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            disabled={isBillingLoading}
            onClick={() => void loadBillingStatus()}
          >
            Refresh
          </Button>
        </div>
      </div>
    </section>
  );
}
