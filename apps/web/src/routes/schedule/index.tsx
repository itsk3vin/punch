import { useAuth0 } from "@auth0/auth0-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Label } from "@/components/ui/label";
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

export function ScheduleRoute() {
  const { getAccessTokenSilently } = useAuth0();
  const { employee, organization, isLoading: meLoading } = useEmployee();
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");

  const reload = useCallback(async () => {
    if (!organization) {
      return;
    }

    const token = await getAccessTokenSilently();
    const headers = { authorization: `Bearer ${token}` };

    const [locRes, depRes] = await Promise.all([
      fetch(
        `${apiBaseUrl}/api/v1/organizations/${organization.id}/locations`,
        { headers },
      ),
      fetch(
        `${apiBaseUrl}/api/v1/organizations/${organization.id}/departments`,
        { headers },
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
    if (!organization || meLoading) {
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
            e instanceof Error ? e.message : "Could not load schedule context.",
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
  }, [meLoading, organization, reload]);

  /** Default selection from the employee record once lists load. */
  useEffect(() => {
    if (locations.length === 0 || selectedLocationId) {
      return;
    }

    const prefer = employee?.locationId ?? locations[0]?.id ?? "";
    if (prefer) {
      setSelectedLocationId(prefer);
    }
  }, [employee?.locationId, locations, selectedLocationId]);

  useEffect(() => {
    if (departments.length === 0 || selectedDepartmentId || !selectedLocationId) {
      return;
    }

    const preferDept = employee?.departmentId;
    if (preferDept) {
      const meta = departments.find((d) => d.id === preferDept);
      if (
        meta &&
        (!selectedLocationId || meta.locationId === selectedLocationId)
      ) {
        setSelectedDepartmentId(preferDept);
        return;
      }
    }

    const firstInLoc = departments.find(
      (d) => d.locationId === selectedLocationId,
    );
    if (firstInLoc) {
      setSelectedDepartmentId(firstInLoc.id);
    }
  }, [
    departments,
    employee?.departmentId,
    selectedDepartmentId,
    selectedLocationId,
  ]);

  const departmentsInLocation = useMemo(
    () =>
      departments.filter(
        (d) => !selectedLocationId || d.locationId === selectedLocationId,
      ),
    [departments, selectedLocationId],
  );

  const locationName =
    locations.find((l) => l.id === selectedLocationId)?.name ?? "—";
  const departmentName =
    departments.find((d) => d.id === selectedDepartmentId)?.name ?? "—";

  if (meLoading || (isLoadingData && locations.length === 0)) {
    return (
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">Loading schedule…</p>
      </section>
    );
  }

  if (!employee || !organization) {
    return null;
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Schedule
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Schedule</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Choose the location and department you want to view. Choices follow
        your access in the organization.
      </p>

      {loadError ? (
        <p className="mt-6 text-sm text-destructive">{loadError}</p>
      ) : (
        <div className="mt-6 flex max-w-xl flex-col gap-4 sm:flex-row sm:items-end">
          <div className="grid flex-1 gap-2">
            <Label htmlFor="schedule-location">Location</Label>
            <select
              id="schedule-location"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={selectedLocationId}
              onChange={(e) => {
                const next = e.target.value;
                setSelectedLocationId(next);
                setSelectedDepartmentId("");
              }}
              disabled={locations.length === 0}
            >
              {locations.length === 0 ? (
                <option value="">No locations</option>
              ) : (
                locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid flex-1 gap-2">
            <Label htmlFor="schedule-department">Department</Label>
            <select
              id="schedule-department"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={selectedDepartmentId}
              onChange={(e) => setSelectedDepartmentId(e.target.value)}
              disabled={departmentsInLocation.length === 0}
            >
              <option value="">— optional —</option>
              {departmentsInLocation.map((dep) => (
                <option key={dep.id} value={dep.id}>
                  {dep.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {!loadError && (
        <div className="mt-8 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          <p>
            Showing context:{" "}
            <span className="font-medium text-foreground">
              {selectedDepartmentId
                ? `${locationName} / ${departmentName}`
                : locationName}
            </span>
          </p>
          <p className="mt-2">
            Shift grid and assignments will appear here when scheduling is
            wired up.
          </p>
        </div>
      )}
    </section>
  );
}
