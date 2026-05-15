import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useParams } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEmployee } from "@/hooks/use-employee";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

type LocationRow = {
  id: string;
  name: string;
};

type DepartmentRow = {
  id: string;
  locationId: string;
  name: string;
};

export function SettingsDepartmentsRoute() {
  const { orgname } = useParams();
  const { getAccessTokenSilently } = useAuth0();
  const { employee, organization, isLoading } = useEmployee();
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [renameTarget, setRenameTarget] = useState<DepartmentRow | null>(null);

  const canManage = employee?.role === "admin" || employee?.role === "manager";

  const locationNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const loc of locations) {
      map.set(loc.id, loc.name);
    }
    return map;
  }, [locations]);

  const {
    handleSubmit,
    register,
    reset,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<{ locationId: string; name: string }>({
    defaultValues: { locationId: "", name: "" },
  });

  const createLocationId = watch("locationId");

  const {
    register: registerRename,
    handleSubmit: handleRenameSubmit,
    reset: resetRename,
    formState: {
      errors: renameErrors,
      isSubmitting: isRenameSubmitting,
    },
  } = useForm<{ name: string }>({
    values: renameTarget ? { name: renameTarget.name } : { name: "" },
  });

  const reload = useCallback(async () => {
    if (!organization) {
      return;
    }

    const accessToken = await getAccessTokenSilently();

    const [locRes, depRes] = await Promise.all([
      fetch(
        `${apiBaseUrl}/api/v1/organizations/${organization.id}/locations`,
        { headers: { authorization: `Bearer ${accessToken}` } },
      ),
      fetch(
        `${apiBaseUrl}/api/v1/organizations/${organization.id}/departments`,
        { headers: { authorization: `Bearer ${accessToken}` } },
      ),
    ]);

    const locBody = await locRes.json().catch(() => null);
    const depBody = await depRes.json().catch(() => null);

    if (!locRes.ok) {
      throw new Error(
        typeof locBody?.error === "string"
          ? locBody.error
          : "Could not load locations.",
      );
    }

    if (!depRes.ok) {
      throw new Error(
        typeof depBody?.error === "string"
          ? depBody.error
          : "Could not load departments.",
      );
    }

    setLocations(locBody as LocationRow[]);
    setDepartments(depBody as DepartmentRow[]);
  }, [getAccessTokenSilently, organization]);

  useEffect(() => {
    if (!organization || !canManage) {
      return;
    }

    let cancelled = false;

    async function run() {
      setIsLoadingData(true);
      setLoadError(null);
      try {
        await reload();
      } catch (e) {
        if (!cancelled) {
          setLoadError(
            e instanceof Error ? e.message : "Could not load departments.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingData(false);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [canManage, organization, reload]);

  useEffect(() => {
    if (locations.length > 0 && !createLocationId) {
      reset((prev) => ({ ...prev, locationId: locations[0]?.id ?? "" }));
    }
  }, [locations, createLocationId, reset]);

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">Loading…</div>
    );
  }

  if (!employee || !canManage) {
    return <Navigate to={`/${orgname ?? ""}/settings/profile`} replace />;
  }

  const sortedDepartments = [...departments].sort((a, b) => {
    const la = `${locationNameById.get(a.locationId) ?? ""}:${a.name}`;
    const lb = `${locationNameById.get(b.locationId) ?? ""}:${b.name}`;
    return la.localeCompare(lb);
  });

  async function onCreate(values: { locationId: string; name: string }) {
    if (!organization) {
      return;
    }

    const name = values.name.trim();
    if (name === "") {
      toast.error("Name is required.");
      return;
    }

    const locationId = values.locationId.trim();
    if (locationId === "") {
      toast.error("Pick a location.");
      return;
    }

    try {
      const accessToken = await getAccessTokenSilently();
      const response = await fetch(
        `${apiBaseUrl}/api/v1/organizations/${organization.id}/departments`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ locationId, name }),
        },
      );

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : "Could not create department.",
        );
      }

      reset({ locationId: values.locationId, name: "" });
      toast.success("Department created.");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create department.");
    }
  }

  async function onRename(values: { name: string }) {
    if (!organization || !renameTarget) {
      return;
    }

    const name = values.name.trim();
    if (name === "") {
      toast.error("Name is required.");
      return;
    }

    try {
      const accessToken = await getAccessTokenSilently();
      const response = await fetch(
        `${apiBaseUrl}/api/v1/organizations/${organization.id}/departments/${renameTarget.id}`,
        {
          method: "PATCH",
          headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ name }),
        },
      );

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : "Could not update department.",
        );
      }

      setRenameTarget(null);
      resetRename({ name: "" });
      toast.success("Department updated.");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update department.");
    }
  }

  return (
    <section className="w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-medium tracking-tight">Departments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Departments are scoped under a location. Managers need access to that
          location to add departments.
        </p>
      </div>

      <form
        onSubmit={handleSubmit((v) => void onCreate(v))}
        className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="grid min-w-[160px] flex-1 gap-2">
          <Label htmlFor="dept-location">Location</Label>
          <select
            id="dept-location"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            disabled={isSubmitting || locations.length === 0}
            {...register("locationId", { required: true })}
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid min-w-[200px] flex-1 gap-2">
          <Label htmlFor="dept-name">Department name</Label>
          <Input
            id="dept-name"
            placeholder="Kitchen"
            disabled={isSubmitting}
            {...register("name", {
              validate: (v) => v.trim().length > 0 || "Required",
            })}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <Button type="submit" disabled={isSubmitting || locations.length === 0}>
          {isSubmitting ? "Adding…" : "Add department"}
        </Button>
      </form>

      <div className="rounded-xl border bg-card [&_table_td]:py-3 [&_table_th]:px-4 [&_table_td]:px-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Location</TableHead>
              <TableHead>Department</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingData ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : loadError ? (
              <TableRow>
                <TableCell colSpan={3} className="text-destructive">
                  {loadError}
                </TableCell>
              </TableRow>
            ) : sortedDepartments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  No departments yet.
                </TableCell>
              </TableRow>
            ) : (
              sortedDepartments.map((dep) => (
                <TableRow key={dep.id}>
                  <TableCell>{locationNameById.get(dep.locationId) ?? "—"}</TableCell>
                  <TableCell>{dep.name}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => setRenameTarget(dep)}
                    >
                      Rename
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenameTarget(null);
            resetRename({ name: "" });
          }
        }}
      >
        <DialogContent>
          <form onSubmit={handleRenameSubmit((v) => void onRename(v))}>
            <DialogHeader>
              <DialogTitle>Rename department</DialogTitle>
            </DialogHeader>
            <div className="mt-4 grid gap-2">
              <Label htmlFor="rename-dept">Name</Label>
              <Input
                id="rename-dept"
                disabled={isRenameSubmitting}
                {...registerRename("name", {
                  validate: (v) => v.trim().length > 0 || "Required",
                })}
              />
              {renameErrors.name && (
                <p className="text-xs text-destructive">
                  {renameErrors.name.message}
                </p>
              )}
            </div>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameTarget(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isRenameSubmitting}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
