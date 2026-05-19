import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { IconCheck, IconPencil, IconPlus, IconX } from "@tabler/icons-react";

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

type LocationEditableField = keyof LocationFormValues;

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

function formatLocationFieldLabel(field: LocationEditableField) {
  if (field === "address") {
    return "Street address";
  }

  return field.charAt(0).toUpperCase() + field.slice(1);
}

function LocationField({
  id,
  label,
  value,
  isEditing,
  isSaving,
  canEdit,
  onChange,
  onStartEdit,
  onCancel,
  onSave,
}: {
  id: string;
  label: string;
  value: string;
  isEditing: boolean;
  isSaving: boolean;
  canEdit: boolean;
  onChange: (value: string) => void;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <div className="relative min-w-0">
        <Input
          id={id}
          value={value}
          disabled={!isEditing || isSaving}
          readOnly={!isEditing}
          autoFocus={isEditing}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onSave();
            }
            if (event.key === "Escape") {
              onCancel();
            }
          }}
          className={`h-9 min-w-0 disabled:cursor-default disabled:opacity-100 ${
            isEditing ? "pr-20" : "pr-10"
          }`}
        />
        {isEditing ? (
          <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-1">
            <Button
              type="button"
              size="icon"
              className="size-7"
              disabled={isSaving}
              onClick={onSave}
            >
              <IconCheck className="size-4" />
              <span className="sr-only">Save {label}</span>
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-7 bg-background"
              disabled={isSaving}
              onClick={onCancel}
            >
              <IconX className="size-4" />
              <span className="sr-only">Cancel editing {label}</span>
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            disabled={!canEdit}
            onClick={onStartEdit}
          >
            <IconPencil className="size-4" />
            <span className="sr-only">Edit {label}</span>
          </Button>
        )}
      </div>
    </div>
  );
}

function LocationDetailsForm({
  location,
  values,
  editingField,
  savingField,
  canEdit,
  onChange,
  onStartEdit,
  onCancel,
  onSave,
}: {
  location: LocationDetail;
  values: LocationFormValues;
  editingField: LocationEditableField | null;
  savingField: LocationEditableField | null;
  canEdit: boolean;
  onChange: (field: LocationEditableField, value: string) => void;
  onStartEdit: (field: LocationEditableField) => void;
  onCancel: () => void;
  onSave: (field: LocationEditableField) => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <LocationField
          id="location-name"
          label="Name"
          value={values.name}
          isEditing={editingField === "name"}
          isSaving={savingField === "name"}
          canEdit={canEdit && editingField === null}
          onChange={(value) => onChange("name", value)}
          onStartEdit={() => onStartEdit("name")}
          onCancel={onCancel}
          onSave={() => onSave("name")}
        />
        <div className="grid min-w-0 gap-1.5">
          <Label
            htmlFor="location-manager"
            className="text-xs text-muted-foreground"
          >
            Manager
          </Label>
          <Input
            id="location-manager"
            value={location.managers.join(", ") || "No manager"}
            disabled
            readOnly
            className="h-9 disabled:cursor-default disabled:opacity-100"
          />
        </div>
      </div>
      <LocationField
        id="location-address"
        label="Street address"
        value={values.address}
        isEditing={editingField === "address"}
        isSaving={savingField === "address"}
        canEdit={canEdit && editingField === null}
        onChange={(value) => onChange("address", value)}
        onStartEdit={() => onStartEdit("address")}
        onCancel={onCancel}
        onSave={() => onSave("address")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <LocationField
          id="location-city"
          label="City"
          value={values.city}
          isEditing={editingField === "city"}
          isSaving={savingField === "city"}
          canEdit={canEdit && editingField === null}
          onChange={(value) => onChange("city", value)}
          onStartEdit={() => onStartEdit("city")}
          onCancel={onCancel}
          onSave={() => onSave("city")}
        />
        <LocationField
          id="location-state"
          label="State"
          value={values.state}
          isEditing={editingField === "state"}
          isSaving={savingField === "state"}
          canEdit={canEdit && editingField === null}
          onChange={(value) => onChange("state", value)}
          onStartEdit={() => onStartEdit("state")}
          onCancel={onCancel}
          onSave={() => onSave("state")}
        />
      </div>
    </div>
  );
}

function LocationMembersTable({ members }: { members: LocationMember[] }) {
  return (
    <div className="w-full text-sm [&_table_td]:h-14 [&_table_td]:py-2 [&_table_th]:h-14 [&_table_th]:py-2">
      <Table className="border-separate border-spacing-x-0 border-spacing-y-2 [&_tr[data-location-member-row]>td]:border-y [&_tr[data-location-member-row]>td]:border-border [&_tr[data-location-member-row]>td]:bg-background [&_tr[data-location-member-row]>td]:transition-colors [&_tr[data-location-member-row]>td:first-child]:rounded-l-lg [&_tr[data-location-member-row]>td:first-child]:border-l [&_tr[data-location-member-row]>td:last-child]:rounded-r-lg [&_tr[data-location-member-row]>td:last-child]:border-r [&_tr[data-location-member-row]:hover>td]:bg-muted/25">
        <TableHeader className="hover:bg-transparent border-0">
          <TableRow className="hover:bg-transparent border-0 [&>th]:border-y [&>th]:border-border [&>th]:bg-background [&>th:first-child]:rounded-l-lg [&>th:first-child]:border-l [&>th:last-child]:rounded-r-lg [&>th:last-child]:border-r">
            <TableHead className="font-medium text-foreground">Name</TableHead>
            <TableHead className="font-medium text-foreground">Role</TableHead>
            <TableHead className="text-right">Joined</TableHead>
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
                <TableCell>{formatRole(member.role)}</TableCell>
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
  const [editingField, setEditingField] =
    useState<LocationEditableField | null>(null);
  const [savingField, setSavingField] =
    useState<LocationEditableField | null>(null);
  const [draftValues, setDraftValues] = useState<LocationFormValues>({
    name: "",
    address: "",
    city: "",
    state: "",
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

  useEffect(() => {
    if (!location) {
      return;
    }

    setDraftValues({
      name: location.name,
      address: location.address,
      city: location.city,
      state: location.state,
    });
    setEditingField(null);
  }, [location]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  if (!employee || !canAccessPage) {
    return <Navigate to={`/${orgname ?? ""}/settings/profile`} replace />;
  }

  function startEditingField(field: LocationEditableField) {
    if (!location) {
      return;
    }

    setDraftValues({
      name: location.name,
      address: location.address,
      city: location.city,
      state: location.state,
    });
    setEditingField(field);
  }

  function cancelEditingField() {
    if (location) {
      setDraftValues({
        name: location.name,
        address: location.address,
        city: location.city,
        state: location.state,
      });
    }
    setEditingField(null);
  }

  async function saveLocationField(field: LocationEditableField) {
    if (!organization || !location) {
      return;
    }

    const nextValues = {
      name: draftValues.name.trim(),
      address: draftValues.address.trim(),
      city: draftValues.city.trim(),
      state: draftValues.state.trim(),
    };

    if (!nextValues[field]) {
      toast.error(`${formatLocationFieldLabel(field)} is required.`);
      return;
    }

    try {
      setSavingField(field);
      const accessToken = await getAccessTokenSilently();
      const response = await fetch(
        `${apiBaseUrl}/api/v1/organizations/${organization.id}/locations/${location.id}`,
        {
          method: "PATCH",
          headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(nextValues),
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

      const updatedLocation = body as Partial<LocationDetail> | null;
      setLocation({
        ...location,
        ...nextValues,
        ...(updatedLocation ?? {}),
      });
      setEditingField(null);
      toast.success("Location updated.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not update location.",
      );
    } finally {
      setSavingField(null);
    }
  }

  return (
    <section className="w-full max-w-full">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-8">
        <Link
          to={`/${orgname ?? ""}/settings/locations`}
          className="text-sm text-muted-foreground hover:text-foreground mx-4"
        >
          Locations
        </Link>

        {isLoadingLocation ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : loadError ? (
          <div className="text-sm text-destructive">{loadError}</div>
        ) : location ? (
          <div className="px-4">
            <div className="mx-auto w-full max-w-xl pt-24">
              <LocationDetailsForm
                location={location}
                values={draftValues}
                editingField={editingField}
                savingField={savingField}
                canEdit={canEdit}
                onChange={(field, value) =>
                  setDraftValues((current) => ({
                    ...current,
                    [field]: value,
                  }))
                }
                onStartEdit={startEditingField}
                onCancel={cancelEditingField}
                onSave={(field) => void saveLocationField(field)}
              />

              <div className="mt-12 mb-4 flex items-center justify-between gap-3">
                <h1 className="text-xl font-medium tracking-tight">
                  Employees
                </h1>
                <Button asChild size="sm" variant="outline">
                  <Link to={`/${orgname ?? ""}/settings/members`}>
                    <IconPlus className="size-4" />
                    Invite person
                  </Link>
                </Button>
              </div>
              <LocationMembersTable members={location.members} />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
