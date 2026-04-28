export function DashboardRoute() {
  return (
    <section className="grid gap-6 md:grid-cols-3">
      {["Routes", "Styling", "Workspace"].map((label) => (
        <article
          key={label}
          className="rounded-lg border border-border bg-card p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold">{label}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This card is rendered from the sample dashboard route.
          </p>
        </article>
      ))}
    </section>
  );
}
