import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
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
  address: string;
  city: string;
  state: string;
  employeeCount: number;
  managers: string[];
};

type LocationFormValues = {
  name: string;
  address: string;
  city: string;
  state: string;
};

const emptyLocationForm: LocationFormValues = {
  name: "",
  address: "",
  city: "",
  state: "",
};

export function SettingsLocationsRoute() {
  const { orgname } = useParams();
  const navigate = useNavigate();
  const { getAccessTokenSilently } = useAuth0();
  const { employee, organization, isLoading } = useEmployee();
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [renameTarget, setRenameTarget] = useState<LocationRow | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const {
    handleSubmit,
    register,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LocationFormValues>({
    defaultValues: emptyLocationForm,
  });

  const {
    register: registerRename,
    handleSubmit: handleRenameSubmit,
    reset: resetRename,
    formState: { errors: renameErrors, isSubmitting: isRenameSubmitting },
  } = useForm<LocationFormValues>({
    values: renameTarget
      ? {
          name: renameTarget.name,
          address: renameTarget.address,
          city: renameTarget.city,
          state: renameTarget.state,
        }
      : emptyLocationForm,
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
        typeof body?.error === "string"
          ? body.error
          : "Could not load locations.",
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
          setLoadError(
            e instanceof Error ? e.message : "Could not load locations.",
          );
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
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  if (!employee || !canManage) {
    return <Navigate to={`/${orgname ?? ""}/settings/profile`} replace />;
  }

  async function onCreate(values: LocationFormValues) {
    if (!organization) {
      return;
    }

    const name = values.name.trim();
    if (name === "") {
      toast.error("Name is required.");
      return;
    }
    const address = values.address.trim();
    if (address === "") {
      toast.error("Address is required.");
      return;
    }
    const city = values.city.trim();
    if (city === "") {
      toast.error("City is required.");
      return;
    }
    const state = values.state.trim();
    if (state === "") {
      toast.error("State is required.");
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
          body: JSON.stringify({ name, address, city, state }),
        },
      );

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : "Could not create location.",
        );
      }

      reset(emptyLocationForm);
      setIsAddDialogOpen(false);
      toast.success("Location created.");
      await reload();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not create location.",
      );
    }
  }

  async function onRename(values: LocationFormValues) {
    if (!organization || !renameTarget) {
      return;
    }

    const name = values.name.trim();
    if (name === "") {
      toast.error("Name is required.");
      return;
    }
    const address = values.address.trim();
    if (address === "") {
      toast.error("Address is required.");
      return;
    }
    const city = values.city.trim();
    if (city === "") {
      toast.error("City is required.");
      return;
    }
    const state = values.state.trim();
    if (state === "") {
      toast.error("State is required.");
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
          body: JSON.stringify({ name, address, city, state }),
        },
      );

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : "Could not update location.",
        );
      }

      setRenameTarget(null);
      resetRename(emptyLocationForm);
      toast.success("Location updated.");
      await reload();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not update location.",
      );
    }
  }

  return (
    <section className="w-full max-w-full">
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4 mr-4">
          <div className="flex flex-col mx-4">
            <h1 className="text-xl font-medium tracking-tight">Locations</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create and update work sites.
            </p>
          </div>
          <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
            Add location
          </Button>
        </div>

        <div className="w-full rounded-xl bg-card text-sm [&_table_td]:py-2 [&_table_th]:h-auto [&_table_th]:py-2 [&_table_th]:px-4 [&_table_td]:px-4">
          <Table className="border-separate border-spacing-x-0 border-spacing-y-0.5 [&_tr[data-location-row]>td]:transition-colors [&_tr[data-location-row]>td:first-child]:rounded-l-lg [&_tr[data-location-row]>td:last-child]:rounded-r-lg [&_tr[data-location-row]:hover>td]:bg-muted/25 rounded-lg">
            <TableHeader className="border-0">
              <TableRow className="hover:bg-transparent border-0">
                <TableHead className="border-0 rounded-tl-lg bg-muted/50">
                  Name
                </TableHead>
                <TableHead className="border-0 bg-muted/50">Manager</TableHead>
                <TableHead className="border-0 bg-muted/50">Location</TableHead>
                <TableHead className="border-0 bg-muted/50">
                  Employees
                </TableHead>
                <TableHead className="border-0 rounded-tr-lg bg-muted/50 text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingLocations ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-muted-foreground"
                  >
                    Loading…
                  </TableCell>
                </TableRow>
              ) : loadError ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-destructive"
                  >
                    {loadError}
                  </TableCell>
                </TableRow>
              ) : locations.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No locations yet.
                  </TableCell>
                </TableRow>
              ) : (
                locations.map((loc) => {
                  const locationPath = `/${orgname ?? ""}/settings/locations/${encodeURIComponent(
                    loc.name,
                  )}`;

                  return (
                    <TableRow
                      key={loc.id}
                      data-location-row=""
                      role="link"
                      tabIndex={0}
                      className="cursor-pointer hover:bg-transparent"
                      onClick={() => navigate(locationPath)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          navigate(locationPath);
                        }
                      }}
                    >
                      <TableCell>
                        <Link
                          to={locationPath}
                          className="font-medium hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {loc.name}
                        </Link>
                      </TableCell>
                      <TableCell>{loc.managers.join(", ") || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {[loc.city, loc.state].filter(Boolean).join(", ") ||
                          "—"}
                      </TableCell>
                      <TableCell>{loc.employeeCount}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setRenameTarget(loc);
                          }}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add location dialog */}
      <Dialog
        open={isAddDialogOpen}
        onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) {
            reset(emptyLocationForm);
          }
        }}
      >
        <DialogContent>
          <form onSubmit={handleSubmit((v) => void onCreate(v))}>
            <DialogHeader>
              <DialogTitle>Add location</DialogTitle>
            </DialogHeader>
            <div className="mt-4 grid gap-2">
              <Label htmlFor="new-location-name">Name</Label>
              <Input
                id="new-location-name"
                placeholder="Main store"
                disabled={isSubmitting}
                {...register("name", {
                  validate: (v) => v.trim().length > 0 || "Required",
                })}
              />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className="mt-4 grid gap-2">
              <Label htmlFor="new-location-address">Address</Label>
              <Input
                id="new-location-address"
                placeholder="123 Main St"
                disabled={isSubmitting}
                {...register("address", {
                  validate: (v) => v.trim().length > 0 || "Required",
                })}
              />
              {errors.address && (
                <p className="text-xs text-destructive">
                  {errors.address.message}
                </p>
              )}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="new-location-city">City</Label>
                <Input
                  id="new-location-city"
                  placeholder="Chicago"
                  disabled={isSubmitting}
                  {...register("city", {
                    validate: (v) => v.trim().length > 0 || "Required",
                  })}
                />
                {errors.city && (
                  <p className="text-xs text-destructive">
                    {errors.city.message}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-location-state">State</Label>
                <Input
                  id="new-location-state"
                  placeholder="IL"
                  disabled={isSubmitting}
                  {...register("state", {
                    validate: (v) => v.trim().length > 0 || "Required",
                  })}
                />
                {errors.state && (
                  <p className="text-xs text-destructive">
                    {errors.state.message}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => setIsAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Adding…" : "Add location"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit location dialog */}
      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenameTarget(null);
            resetRename(emptyLocationForm);
          }
        }}
      >
        <DialogContent>
          <form onSubmit={handleRenameSubmit((v) => void onRename(v))}>
            <DialogHeader>
              <DialogTitle>Edit location</DialogTitle>
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
            <div className="mt-4 grid gap-2">
              <Label htmlFor="rename-location-address">Address</Label>
              <Input
                id="rename-location-address"
                disabled={isRenameSubmitting}
                {...registerRename("address", {
                  validate: (v) => v.trim().length > 0 || "Required",
                })}
              />
              {renameErrors.address && (
                <p className="text-xs text-destructive">
                  {renameErrors.address.message}
                </p>
              )}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="rename-location-city">City</Label>
                <Input
                  id="rename-location-city"
                  disabled={isRenameSubmitting}
                  {...registerRename("city", {
                    validate: (v) => v.trim().length > 0 || "Required",
                  })}
                />
                {renameErrors.city && (
                  <p className="text-xs text-destructive">
                    {renameErrors.city.message}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rename-location-state">State</Label>
                <Input
                  id="rename-location-state"
                  disabled={isRenameSubmitting}
                  {...registerRename("state", {
                    validate: (v) => v.trim().length > 0 || "Required",
                  })}
                />
                {renameErrors.state && (
                  <p className="text-xs text-destructive">
                    {renameErrors.state.message}
                  </p>
                )}
              </div>
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
                {isRenameSubmitting ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
