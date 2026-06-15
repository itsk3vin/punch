import { NavLink, Outlet, useParams } from "react-router";

import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useBillingStatus } from "@/hooks/use-billing-status";
import { useEmployee } from "@/hooks/use-employee";

function RestrictedAccess() {
  const { orgname } = useParams();
  const { employee } = useEmployee();
  const isAdmin = employee?.role === "admin";

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center">
      <h1 className="text-xl font-semibold tracking-tight">Access restricted</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {isAdmin
          ? "This organization needs an active subscription before core app features are available."
          : "This organization needs an active subscription before core app features are available. Contact an admin to restore access."}
      </p>
      {isAdmin && (
        <Button asChild className="mt-5 w-fit">
          <NavLink to={`/${orgname ?? ""}/settings/billing`}>
            Go to billing
          </NavLink>
        </Button>
      )}
    </div>
  );
}

export function AppLayout() {
  const { status, isLoading } = useBillingStatus();
  
  return (
    <SidebarProvider>
      <Sidebar />
      <SidebarInset className="overflow-y-auto px-8 py-10">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : status && !status.accessAllowed ? (
          <RestrictedAccess />
        ) : (
          <Outlet />
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
