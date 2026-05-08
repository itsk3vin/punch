import { NavLink, Outlet, useParams } from "react-router";

export function SettingsRoute() {
  const { orgname } = useParams();
  const organizationPath = `/${orgname ?? ""}`;

  return (
    <section className="grid gap-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Settings
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Settings</h1>
      </div>

      <nav className="flex gap-2 border-b border-border">
        <NavLink
          to={`${organizationPath}/settings/members`}
          className={({ isActive }) =>
            [
              "border-b-2 px-1 pb-3 text-sm font-medium",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            ].join(" ")
          }
        >
          Members
        </NavLink>
      </nav>

      <Outlet />
    </section>
  );
}
