import { useAuth0 } from "@auth0/auth0-react";
import { Link, useLocation, useNavigate } from "react-router";

export function LoginRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, loginWithRedirect, logout, user } =
    useAuth0();
  const from = (location.state as { from?: { pathname: string } } | null)?.from
    ?.pathname;

  if (isLoading) {
    return (
      <section className="mx-auto max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
        <p className="text-sm text-muted-foreground">Loading auth state...</p>
      </section>
    );
  }

  if (isAuthenticated) {
    return (
      <section className="mx-auto max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">You are signed in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Signed in as {user?.email ?? user?.name ?? "your Auth0 user"}.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground"
            type="button"
            onClick={() => navigate(from ?? "/dashboard")}
          >
            Continue
          </button>
          <button
            className="rounded-md border border-border px-4 py-2 font-medium hover:bg-accent hover:text-accent-foreground"
            type="button"
            onClick={() =>
              logout({ logoutParams: { returnTo: window.location.origin } })
            }
          >
            Sign out
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Use Auth0 Universal Login to access your Punch dashboard.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground"
          type="button"
          onClick={() =>
            loginWithRedirect({
              appState: { returnTo: from ?? "/dashboard" },
            })
          }
        >
          Sign in with Auth0
        </button>
        <Link
          className="rounded-md border border-border px-4 py-2 font-medium hover:bg-accent hover:text-accent-foreground"
          to="/"
        >
          Back home
        </Link>
      </div>
    </section>
  );
}
