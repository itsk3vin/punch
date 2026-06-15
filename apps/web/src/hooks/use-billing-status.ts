import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";

import { useEmployee } from "@/hooks/use-employee";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

export type BillingStatus = {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  stripePriceId: string | null;
  billableLocationCount: number;
  billingQuantity: number | null;
  currentPeriodEnd: string | null;
  accessAllowed: boolean;
};

export function useBillingStatus() {
  const { getAccessTokenSilently } = useAuth0();
  const { organization } = useEmployee();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!organization) {
      return;
    }

    const abortController = new AbortController();
    const organizationId = organization.id;

    async function loadBillingStatus() {
      setIsLoading(true);
      setError(null);
      try {
        const accessToken = await getAccessTokenSilently();
        const response = await fetch(
          `${apiBaseUrl}/api/v1/organizations/${organizationId}/billing/status`,
          {
            headers: {
              authorization: `Bearer ${accessToken}`,
            },
            signal: abortController.signal,
          },
        );

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: unknown;
          } | null;
          throw new Error(
            String(body?.error ?? "failed to load billing status"),
          );
        }

        setStatus((await response.json()) as BillingStatus);
      } catch (unknownError) {
        if (abortController.signal.aborted) {
          return;
        }
        setError(
          unknownError instanceof Error
            ? unknownError
            : new Error("failed to load billing status"),
        );
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadBillingStatus();

    return () => {
      abortController.abort();
    };
  }, [getAccessTokenSilently, organization]);

  return { status, error, isLoading };
}
