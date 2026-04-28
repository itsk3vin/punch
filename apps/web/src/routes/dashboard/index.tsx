import { useAuth0 } from "@auth0/auth0-react";
import { useState } from "react";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

export function DashboardRoute() {
  const { getAccessTokenSilently, user } = useAuth0();
  const [apiMessage, setApiMessage] = useState<string>();
  const [apiError, setApiError] = useState<string>();
  const [isCallingApi, setIsCallingApi] = useState(false);

  async function callProtectedApi() {
    setIsCallingApi(true);
    setApiError(undefined);

    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(`${apiBaseUrl}/api/v1/private`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = (await response.json()) as {
        message?: string;
        subject?: string;
      };
      setApiMessage(`${data.message} Subject: ${data.subject ?? "unknown"}`);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "API call failed");
    } finally {
      setIsCallingApi(false);
    }
  }

  return (
    <section className="grid gap-6">
      <article className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Protected Route
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Signed in as {user?.email ?? user?.name ?? "your Auth0 user"}.
        </p>
      </article>

      <article className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Go API Check</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This calls <code>/api/v1/private</code> with an Auth0 access token.
        </p>
        <button
          className="mt-4 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60"
          type="button"
          disabled={isCallingApi}
          onClick={callProtectedApi}
        >
          {isCallingApi ? "Calling API..." : "Call protected API"}
        </button>
        {apiMessage ? (
          <p className="mt-4 rounded-md bg-secondary p-3 text-sm">
            {apiMessage}
          </p>
        ) : null}
        {apiError ? (
          <p className="mt-4 rounded-md bg-destructive p-3 text-sm text-destructive-foreground">
            {apiError}
          </p>
        ) : null}
      </article>
    </section>
  );
}
