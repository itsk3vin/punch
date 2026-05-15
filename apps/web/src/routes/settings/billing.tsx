import { Navigate, useParams } from "react-router";

import { useEmployee } from "@/hooks/use-employee";

export function SettingsBillingRoute() {
  const { orgname } = useParams();
  const { employee, isLoading } = useEmployee();

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">Loading…</div>
    );
  }

  if (!employee || employee.role !== "admin") {
    return (
      <Navigate to={`/${orgname ?? ""}/settings/profile`} replace />
    );
  }

  return (
    <section className="max-w-2xl">
      <h1 className="text-xl font-semibold tracking-tight">Billing</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your subscription and payment methods.
      </p>
    </section>
  );
}
