import { Link } from "react-router";

export function NotFoundRoute() {
  return (
    <section className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-muted-foreground">
        The route you requested does not exist.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground"
      >
        Back home
      </Link>
    </section>
  );
}
