import { useAuth0 } from "@auth0/auth0-react";
import { NavLink, Outlet } from "react-router";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/dashboard", label: "Dashboard" },
];

export function AppLayout() {
  const { isAuthenticated, logout } = useAuth0();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold">Punch</span>
          <div className="flex gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  ].join(" ")
                }
                end={item.to === "/"}
              >
                {item.label}
              </NavLink>
            ))}
            {isAuthenticated ? (
              <button
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                type="button"
                onClick={() =>
                  logout({
                    logoutParams: { returnTo: window.location.origin },
                  })
                }
              >
                Logout
              </button>
            ) : (
              <NavLink
                to="/auth/login"
                className={({ isActive }) =>
                  [
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  ].join(" ")
                }
              >
                Login
              </NavLink>
            )}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
