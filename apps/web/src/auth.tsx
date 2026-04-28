import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { useEffect, type PropsWithChildren } from "react";
import { useLocation } from "react-router";

const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN;
const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE;

export function AuthProvider({ children }: PropsWithChildren) {
  if (!auth0Domain || !auth0ClientId || !auth0Audience) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <section className="rounded-lg border border-border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight">
            Auth0 is not configured
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Set VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID, and
            VITE_AUTH0_AUDIENCE in apps/web/.env to enable login.
          </p>
        </section>
      </main>
    );
  }

  return (
    <Auth0Provider
      domain={auth0Domain}
      clientId={auth0ClientId}
      cacheLocation="localstorage"
      onRedirectCallback={(appState) => {
        window.history.replaceState(
          {},
          document.title,
          appState?.returnTo ?? window.location.pathname,
        );
      }}
      authorizationParams={{
        audience: auth0Audience,
        redirect_uri: window.location.origin,
      }}
    >
      {children}
    </Auth0Provider>
  );
}

export function RequireAuth({ children }: PropsWithChildren) {
  const location = useLocation();
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();
  const returnTo = `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      void loginWithRedirect({
        appState: { returnTo },
      });
    }
  }, [isAuthenticated, isLoading, loginWithRedirect, returnTo]);

  if (isLoading) {
    return (
      <section className="rounded-lg border border-border bg-card p-8 shadow-sm">
        <p className="text-sm text-muted-foreground">Checking session...</p>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className="">
        <p className="text-sm text-muted-foreground">Redirecting to sign in...</p>
      </section>
    );
  }

  return children;
}
