import { Link } from "react-router";

export function HomeRoute() {
  return (
    <section className="rounded-lg border border-border bg-card p-8 shadow-sm">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Vite + React Router
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight">
        Welcome to Punch
      </h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        This frontend is wired to the shared Tailwind and TypeScript config
        packages and includes a few sample routes.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          to="/auth/login"
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
        >
          Try login route
        </Link>
        <Link
          to="/dashboard"
          className="rounded-md border border-border px-4 py-2 hover:bg-accent hover:text-accent-foreground"
        >
          View dashboard
        </Link>
      </div>
    </section>
  );
}
