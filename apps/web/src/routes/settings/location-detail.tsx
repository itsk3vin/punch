import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useParams } from "react-router";
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
import {
  IconChevronDown,
  IconMapPin,
  IconPencil,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

type LocationMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

type LocationDetail = {
  id: string;
  organizationId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  employeeCount: number;
  managers: string[];
  members: LocationMember[];
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

const joinedDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatJoinedDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return joinedDateFormatter.format(date);
}

function formatRole(role: string) {
  return role
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatAddress(
  location: Pick<LocationDetail, "address" | "city" | "state">,
) {
  return [location.address, location.city, location.state]
    .filter(Boolean)
    .join(", ");
}

function LocationDetailsSidebar({
  location,
  canEdit,
  onEdit,
}: {
  location: LocationDetail;
  canEdit: boolean;
  onEdit: () => void;
}) {
  return (
    <aside className="w-full lg:w-[360px] lg:shrink-0">
      <div className="sticky top-10 grid gap-4">
        <div className="rounded-xl border border-border/80 bg-card p-5 shadow-sm">
          <div className="mb-7 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-medium tracking-tight">Properties</h2>
              <IconChevronDown className="size-4 text-muted-foreground" />
            </div>
            {canEdit && (
              <Button
                size="icon"
                type="button"
                variant="ghost"
                onClick={onEdit}
                className="size-8 text-muted-foreground hover:text-foreground"
              >
                <IconPencil className="size-4" />
                <span className="sr-only">Edit location</span>
              </Button>
            )}
          </div>

          <dl className="grid gap-6">
            <div className="grid grid-cols-[132px_minmax(0,1fr)] items-start gap-4">
              <dt className="text-sm text-muted-foreground">Location</dt>
              <dd className="min-w-0 text-sm font-medium text-foreground">
                {location.name}
              </dd>
            </div>
            <div className="grid grid-cols-[132px_minmax(0,1fr)] items-start gap-4">
              <dt className="text-sm text-muted-foreground">Manager</dt>
              <dd className="flex min-w-0 items-start gap-2 text-sm text-foreground">
                <IconUser className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 truncate">
                  {location.managers.join(", ") || "None"}
                </span>
              </dd>
            </div>
            <div className="grid grid-cols-[132px_minmax(0,1fr)] items-start gap-4">
              <dt className="text-sm text-muted-foreground">Employees</dt>
              <dd className="flex items-center gap-2 text-sm text-foreground">
                <IconUsers className="size-4 text-muted-foreground" />
                {location.employeeCount}
              </dd>
            </div>
            <div className="grid grid-cols-[132px_minmax(0,1fr)] items-start gap-4">
              <dt className="text-sm text-muted-foreground">Address</dt>
              <dd className="flex min-w-0 items-start gap-2 text-sm leading-6 text-foreground">
                <IconMapPin className="mt-1 size-4 shrink-0 text-muted-foreground" />
                <span>{formatAddress(location)}</span>
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-medium tracking-tight">Activity</h2>
            <IconChevronDown className="size-4 text-muted-foreground" />
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            Location created for {location.employeeCount} employees.
          </p>
        </div>
      </div>
    </aside>
  );
}

function LocationMembersTable({ members }: { members: LocationMember[] }) {
  return (
    <div className="w-full rounded-xl bg-card text-sm [&_table_td]:py-2 [&_table_th]:h-auto [&_table_th]:py-2">
      <Table className="border-separate border-spacing-x-0 border-spacing-y-0.5 [&_tr[data-location-member-row]>td]:transition-colors [&_tr[data-location-member-row]>td:first-child]:rounded-l-lg [&_tr[data-location-member-row]>td:last-child]:rounded-r-lg [&_tr[data-location-member-row]:hover>td]:bg-muted/25">
        <TableHeader className="hover:bg-transparent border-0">
          <TableRow className="hover:bg-transparent border-0">
            <TableHead className="border-0">Name</TableHead>
            <TableHead className="border-0">Role</TableHead>
            <TableHead className="border-0 text-right">Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={3}
                className="py-10 text-center text-muted-foreground"
              >
                No members belong to this location.
              </TableCell>
            </TableRow>
          ) : (
            members.map((member) => (
              <TableRow
                key={member.id}
                data-location-member-row=""
                className="hover:bg-transparent"
              >
                <TableCell>{member.name}</TableCell>
                <TableCell>
                  <span className="rounded-md bg-primary/10 px-2 py-1 text-primary">
                    {formatRole(member.role)}
                  </span>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatJoinedDate(member.createdAt)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function SettingsLocationDetailRoute() {
  const { orgname, locationname } = useParams();
  const { getAccessTokenSilently } = useAuth0();
  const { employee, organization, isLoading } = useEmployee();
  const [location, setLocation] = useState<LocationDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const {
    handleSubmit,
    register,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LocationFormValues>({
    values: location
      ? {
          name: location.name,
          address: location.address,
          city: location.city,
          state: location.state,
        }
      : emptyLocationForm,
  });

  const canAccessPage =
    employee?.role === "admin" || employee?.role === "manager";
  const canEdit = canAccessPage && location !== null;

  const decodedLocationName = useMemo(() => {
    return locationname ? decodeURIComponent(locationname) : "";
  }, [locationname]);

  const reload = useCallback(async () => {
    if (!organization || !decodedLocationName) {
      return;
    }

    const accessToken = await getAccessTokenSilently();
    const response = await fetch(
      `${apiBaseUrl}/api/v1/organizations/${organization.id}/locations/by-name/${encodeURIComponent(
        decodedLocationName,
      )}`,
      {
        headers: { authorization: `Bearer ${accessToken}` },
      },
    );

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        typeof body?.error === "string"
          ? body.error
          : "Could not load location.",
      );
    }

    setLocation(body as LocationDetail);
  }, [decodedLocationName, getAccessTokenSilently, organization]);

  useEffect(() => {
    if (!organization || !canAccessPage) {
      return;
    }

    let cancelled = false;

    async function run() {
      setIsLoadingLocation(true);
      setLoadError(null);
      try {
        await reload();
      } catch (e) {
        if (!cancelled) {
          setLoadError(
            e instanceof Error ? e.message : "Could not load location.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingLocation(false);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [canAccessPage, organization, reload]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  if (!employee || !canAccessPage) {
    return <Navigate to={`/${orgname ?? ""}/settings/profile`} replace />;
  }

  async function onSave(values: LocationFormValues) {
    if (!organization || !location) {
      return;
    }

    const name = values.name.trim();
    const address = values.address.trim();
    const city = values.city.trim();
    const state = values.state.trim();

    if (!name || !address || !city || !state) {
      toast.error("Name, address, city, and state are required.");
      return;
    }

    try {
      const accessToken = await getAccessTokenSilently();
      const response = await fetch(
        `${apiBaseUrl}/api/v1/organizations/${organization.id}/locations/${location.id}`,
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

      toast.success("Location updated.");
      setIsEditDialogOpen(false);
      await reload();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not update location.",
      );
    }
  }

  return (
    <section className="w-full max-w-full">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4">
        <Link
          to={`/${orgname ?? ""}/settings/locations`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Locations
        </Link>

        {isLoadingLocation ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : loadError ? (
          <div className="text-sm text-destructive">{loadError}</div>
        ) : location ? (
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
            <main className="min-w-0 flex-1">
              <div className="mx-auto w-full max-w-4xl">
                <div className="mb-8">
                  <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <IconMapPin className="size-6" />
                  </div>
                  <h1 className="text-3xl font-semibold tracking-tight">
                    {location.name}
                  </h1>
                  <p className="mt-3 text-base text-muted-foreground">
                    {formatAddress(location)}
                  </p>
                </div>

                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-medium tracking-tight">
                    Employees
                  </h2>
                </div>
                <LocationMembersTable members={location.members} />
              </div>
            </main>

            <LocationDetailsSidebar
              location={location}
              canEdit={canEdit}
              onEdit={() => setIsEditDialogOpen(true)}
            />
          </div>
        ) : null}

        {location ? (
          <Dialog
            open={isEditDialogOpen}
            onOpenChange={(open) => {
              setIsEditDialogOpen(open);
              if (!open) {
                reset({
                  name: location.name,
                  address: location.address,
                  city: location.city,
                  state: location.state,
                });
              }
            }}
          >
            <DialogContent>
              <form onSubmit={handleSubmit((values) => void onSave(values))}>
                <DialogHeader>
                  <DialogTitle>Edit location</DialogTitle>
                </DialogHeader>
                <div className="mt-4 grid gap-2">
                  <Label htmlFor="location-address">Street address</Label>
                  <Input
                    id="location-address"
                    disabled={isSubmitting}
                    autoFocus
                    {...register("address", {
                      validate: (fieldValue) =>
                        fieldValue.trim().length > 0 || "Required",
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
                    <Label htmlFor="location-city">City</Label>
                    <Input
                      id="location-city"
                      disabled={isSubmitting}
                      {...register("city", {
                        validate: (fieldValue) =>
                          fieldValue.trim().length > 0 || "Required",
                      })}
                    />
                    {errors.city && (
                      <p className="text-xs text-destructive">
                        {errors.city.message}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="location-state">State</Label>
                    <Input
                      id="location-state"
                      disabled={isSubmitting}
                      {...register("state", {
                        validate: (fieldValue) =>
                          fieldValue.trim().length > 0 || "Required",
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
                    onClick={() => setIsEditDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : "Save"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
    </section>
  );
}
