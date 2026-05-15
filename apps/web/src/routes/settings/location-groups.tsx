import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useEffect, useState } from "react";
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

type LocationGroupRow = {
  id: string;
  name: string;
};

export function SettingsLocationGroupsRoute() {
  const { orgname } = useParams();
  const { getAccessTokenSilently } = useAuth0();
  const { employee, organization, isLoading } = useEmployee();
  const [groups, setGroups] = useState<LocationGroupRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<LocationGroupRow | null>(null);
  const [selectedLocationIds, setSelectedLocationIds] = useState<Set<string>>(
    () => new Set(),
  );

  const canManageGroups = employee?.role === "admin";

  const {
    handleSubmit: handleCreateSubmit,
    register: registerCreate,
    reset: resetCreate,
    formState: {
      errors: createErrors,
      isSubmitting: isCreateSubmitting,
    },
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

  const reload = useCallback(async () => {
    if (!organization) {
      return;
    }

    const accessToken = await getAccessTokenSilently();

    const [groupRes, locRes] = await Promise.all([
      fetch(
        `${apiBaseUrl}/api/v1/organizations/${organization.id}/location-groups`,
        { headers: { authorization: `Bearer ${accessToken}` } },
      ),
      fetch(
        `${apiBaseUrl}/api/v1/organizations/${organization.id}/locations`,
        { headers: { authorization: `Bearer ${accessToken}` } },
      ),
    ]);

    const groupBody = await groupRes.json().catch(() => null);
    const locBody = await locRes.json().catch(() => null);

    if (!groupRes.ok) {
      throw new Error(
        typeof groupBody?.error === "string"
          ? groupBody.error
          : "Could not load location groups.",
      );
    }

    if (!locRes.ok) {
      throw new Error(
        typeof locBody?.error === "string"
          ? locBody.error
          : "Could not load locations.",
      );
    }

    setGroups(groupBody as LocationGroupRow[]);
    setLocations(locBody as LocationRow[]);
  }, [getAccessTokenSilently, organization]);

  useEffect(() => {
    if (!organization || !canManageGroups) {
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
            e instanceof Error ? e.message : "Could not load location groups.",
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
  }, [canManageGroups, organization, reload]);

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">Loading…</div>
    );
  }

  if (!employee || !canManageGroups) {
    return <Navigate to={`/${orgname ?? ""}/settings/profile`} replace />;
  }

  function toggleLocationInCreate(id: string) {
    setSelectedLocationIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
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
        `${apiBaseUrl}/api/v1/organizations/${organization.id}/location-groups`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            name,
            locationIds: [...selectedLocationIds],
          }),
        },
      );

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : "Could not create location group.",
        );
      }

      resetCreate({ name: "" });
      setSelectedLocationIds(new Set());
      setIsCreateOpen(false);
      toast.success("Location group created.");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create location group.");
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
        `${apiBaseUrl}/api/v1/organizations/${organization.id}/location-groups/${renameTarget.id}`,
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
            : "Could not update location group.",
        );
      }

      setRenameTarget(null);
      resetRename({ name: "" });
      toast.success("Location group updated.");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update location group.");
    }
  }

  return (
    <section className="w-full max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium tracking-tight">Location groups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Group locations for regional manager access—for example assigning a
            manager to multiple stores at once.
          </p>
        </div>
        <Button size="sm" type="button" onClick={() => setIsCreateOpen(true)}>
          New group
        </Button>
      </div>

      <div className="rounded-xl border bg-card [&_table_td]:py-3 [&_table_th]:px-4 [&_table_td]:px-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingData ? (
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
            ) : groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-muted-foreground">
                  No location groups yet.
                </TableCell>
              </TableRow>
            ) : (
              groups.map((g) => (
                <TableRow key={g.id}>
                  <TableCell>{g.name}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => setRenameTarget(g)}
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
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            resetCreate({ name: "" });
            setSelectedLocationIds(new Set());
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <form onSubmit={handleCreateSubmit((v) => void onCreate(v))}>
            <DialogHeader>
              <DialogTitle>New location group</DialogTitle>
            </DialogHeader>
            <div className="mt-4 grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="group-name">Group name</Label>
                <Input
                  id="group-name"
                  placeholder="North region"
                  disabled={isCreateSubmitting}
                  {...registerCreate("name", {
                    validate: (v) => v.trim().length > 0 || "Required",
                  })}
                />
                {createErrors.name && (
                  <p className="text-xs text-destructive">
                    {createErrors.name.message}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>Locations in this group</Label>
                <div className="max-h-[220px] space-y-2 overflow-y-auto rounded-md border p-3">
                  {locations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Add locations first.
                    </p>
                  ) : (
                    locations.map((loc) => (
                      <label
                        key={loc.id}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="size-4 rounded border-input"
                          checked={selectedLocationIds.has(loc.id)}
                          onChange={() => toggleLocationInCreate(loc.id)}
                        />
                        {loc.name}
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreateSubmitting}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
              <DialogTitle>Rename location group</DialogTitle>
            </DialogHeader>
            <div className="mt-4 grid gap-2">
              <Label htmlFor="rename-group">Name</Label>
              <Input
                id="rename-group"
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
