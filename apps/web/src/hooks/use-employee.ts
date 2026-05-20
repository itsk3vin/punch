import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

type Employee = {
  id: string;
  userId: string;
  organizationId: string;
  locationId: string | null;
  departmentId: string | null;
  email: string;
  name: string;
  role: string;
};

type Organization = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
};

type InvitationSummary = {
  id: string;
  organizationId: string;
  organizationName: string;
  role: string;
  email: string;
};

export type MeScopePayload =
  | { type: "location"; id: string; name: string }
  | { type: "department"; id: string; name: string };

export type MeResponse =
  | {
      status: "ready";
      employee: Employee;
      organization: Organization;
      scopes: MeScopePayload[];
    }
  | {
      status: "has_invitations";
      email: string;
      invitations: InvitationSummary[];
    }
  | {
      status: "needs_organization";
      email: string;
    }
  | {
      status: "email_unverified";
      email: string;
    };

export function useEmployee() {
  const { getAccessTokenSilently, isAuthenticated, isLoading } = useAuth0();
  const [data, setData] = useState<MeResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      return;
    }

    const abortController = new AbortController();

    async function loadEmployee() {
      setIsFetching(true);
      setHasFetched(false);
      setError(null);

      try {
        const accessToken = await getAccessTokenSilently();
        const response = await fetch(`${apiBaseUrl}/api/v1/me`, {
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
          signal: abortController.signal,
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: unknown;
          } | null;
          const detail =
            body?.error != null && String(body.error).length > 0
              ? String(body.error)
              : `${response.status} ${response.statusText}`;
          throw new Error(detail);
        }

        setData((await response.json()) as MeResponse);
        setHasFetched(true);
      } catch (unknownError) {
        if (abortController.signal.aborted) {
          return;
        }

        setHasFetched(true);
        setError(
          unknownError instanceof Error
            ? unknownError
            : new Error("failed to load employee"),
        );
      } finally {
        if (!abortController.signal.aborted) {
          setIsFetching(false);
        }
      }
    }

    void loadEmployee();

    return () => {
      abortController.abort();
    };
  }, [getAccessTokenSilently, isAuthenticated, isLoading]);

  return {
    data,
    employee: data?.status === "ready" ? data.employee : null,
    organization: data?.status === "ready" ? data.organization : null,
    scopes: data?.status === "ready" ? data.scopes : [],
    error,
    isLoading: isLoading || isFetching || (isAuthenticated && !hasFetched),
  };
}
