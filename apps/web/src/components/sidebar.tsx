import { useAuth0 } from "@auth0/auth0-react";
import { CalendarDays, LayoutDashboard } from "lucide-react";
import { NavLink } from "react-router";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
];

function getInitials(name?: string, email?: string) {
  const source = name || email || "User";
  const parts = source
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function Sidebar() {
  const { isAuthenticated, loginWithRedirect, logout, user } = useAuth0();
  const initials = getInitials(user?.name, user?.email);

  return (
    <aside className="flex min-h-screen w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="border-b border-border px-6 py-5">
        <p className="text-lg font-semibold tracking-tight">Punch</p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )
            }
          >
            <item.icon className="size-4" aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        {isAuthenticated ? (
          <Button
            type="button"
            variant="ghost"
            className="h-auto w-full justify-start gap-3 px-3 py-2"
            onClick={() =>
              logout({
                logoutParams: { returnTo: window.location.origin },
              })
            }
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {initials}
            </span>
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-medium">
                {user?.name ?? "Profile"}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {user?.email ?? "Sign out"}
              </span>
            </span>
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start"
            onClick={() => void loginWithRedirect()}
          >
            Sign in
          </Button>
        )}
      </div>
    </aside>
  );
}
