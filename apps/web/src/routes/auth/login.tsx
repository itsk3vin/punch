export function LoginRoute() {
  return (
    <section className="mx-auto max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sample nested route at <code>/auth/login</code>.
      </p>
      <form className="mt-6 grid gap-4">
        <label className="grid gap-2 text-sm font-medium">
          Email
          <input
            className="rounded-md border border-input bg-background px-3 py-2 outline-none ring-ring focus:ring-2"
            placeholder="you@example.com"
            type="email"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Password
          <input
            className="rounded-md border border-input bg-background px-3 py-2 outline-none ring-ring focus:ring-2"
            placeholder="••••••••"
            type="password"
          />
        </label>
        <button
          className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground"
          type="button"
        >
          Continue
        </button>
      </form>
    </section>
  );
}
