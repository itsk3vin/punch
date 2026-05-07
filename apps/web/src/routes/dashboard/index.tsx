import { useAuth0 } from "@auth0/auth0-react";
import { useState } from "react";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

export function DashboardRoute() {
  const { user } = useAuth0();


  return (
    <section className="grid gap-6">
      <p className="mt-2 text-sm text-muted-foreground">
        Signed in as {user?.email ?? user?.name ?? "your Auth0 user"}.
      </p>
      
    </section>
  );
}
