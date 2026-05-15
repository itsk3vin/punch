import { Navigate, useParams } from "react-router";

import { useEmployee } from "@/hooks/use-employee";

export function SettingsImportRoute() {
  const { orgname } = useParams();
  const { employee, isLoading } = useEmployee();

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">Loading…</div>
    );
  }

  const canAccess =
    employee?.role === "admin" || employee?.role === "manager";

  if (!employee || !canAccess) {
    return <Navigate to={`/${orgname ?? ""}/settings/profile`} replace />;
  }

  return (
    <section className="max-w-2xl">
      <h1 className="text-xl font-semibold tracking-tight">Import</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Import data from other tools and services.
      </p>
    </section>
  );
}
