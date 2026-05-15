import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useEffect, useState } from "react";
import { Navigate, useParams } from "react-router";
import { useForm } from "react-hook-form";
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
  organizationId: string;
  name: string;
};

export function SettingsLocationsRoute() {
  const { orgname } = useParams();
  const { getAccessTokenSilently } = useAuth0();
  const { employee, organization, isLoading } = useEmployee();
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [renameTarget, setRenameTarget] = useState<LocationRow | null>(null);

  const {
    handleSubmit,
    register,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<{ name: string }>({
    defaultValues: { name: "" },
  });

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

  const canManage = employee?.role === "admin" || employee?.role === "manager";

  const reload = useCallback(async () => {
    if (!organization) {
      return;
    }

    const accessToken = await getAccessTokenSilently();
    const response = await fetch(
      `${apiBaseUrl}/api/v1/organizations/${organization.id}/locations`,
      {
        headers: { authorization: `Bearer ${accessToken}` },
      },
    );

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        typeof body?.error === "string" ? body.error : "Could not load locations.",
      );
    }

    setLocations(body as LocationRow[]);
  }, [getAccessTokenSilently, organization]);

  useEffect(() => {
    if (!organization || !canManage) {
      return;
    }

    let cancelled = false;

    async function run() {
      setIsLoadingLocations(true);
      setLoadError(null);
      try {
        await reload();
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Could not load locations.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingLocations(false);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [canManage, organization, reload]);

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">Loading…</div>
    );
  }

  if (!employee || !canManage) {
    return <Navigate to={`/${orgname ?? ""}/settings/profile`} replace />;
  }

  async function onCreate(values: { name: string }) {
    if (!organization) {
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
        `${apiBaseUrl}/api/v1/organizations/${organization.id}/locations`,
        {
          method: "POST",
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
          typeof body?.error === "string" ? body.error : "Could not create location.",
        );
      }

      reset({ name: "" });
      toast.success("Location created.");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create location.");
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
        `${apiBaseUrl}/api/v1/organizations/${organization.id}/locations/${renameTarget.id}`,
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
          typeof body?.error === "string" ? body.error : "Could not update location.",
        );
      }

      setRenameTarget(null);
      resetRename({ name: "" });
      toast.success("Location updated.");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update location.");
    }
  }

  return (
    <section className="w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-medium tracking-tight">Locations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create and rename work sites. Departments belong to a location.
        </p>
      </div>

      <form
        onSubmit={handleSubmit((v) => void onCreate(v))}
        className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4"
      >
        <div className="grid min-w-[200px] flex-1 gap-2">
          <Label htmlFor="new-location-name">New location name</Label>
          <Input
            id="new-location-name"
            placeholder="Main store"
            disabled={isSubmitting}
            {...register("name", {
              validate: (v) => v.trim().length > 0 || "Required",
            })}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Adding…" : "Add location"}
        </Button>
      </form>

      <div className="rounded-xl border bg-card [&_table_td]:py-3 [&_table_th]:px-4 [&_table_td]:px-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingLocations ? (
              <TableRow>
                <TableCell colSpan={2} className="text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : loadError ? (
              <TableRow>
                <TableCell colSpan={2} className="text-destructive">
                  {loadError}
                </TableCell>
              </TableRow>
            ) : locations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-muted-foreground">
                  No locations yet.
                </TableCell>
              </TableRow>
            ) : (
              locations.map((loc) => (
                <TableRow key={loc.id}>
                  <TableCell>{loc.name}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => setRenameTarget(loc)}
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
              <DialogTitle>Rename location</DialogTitle>
            </DialogHeader>
            <div className="mt-4 grid gap-2">
              <Label htmlFor="rename-location">Name</Label>
              <Input
                id="rename-location"
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
