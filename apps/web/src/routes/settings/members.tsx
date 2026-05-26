import { IconDots } from "@tabler/icons-react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useForm } from "react-hook-form";
import {
  Navigate,
  useNavigate,
  useParams,
} from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

type OrganizationMember = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  locationId?: string | null;
  departmentId?: string | null;
};

type OrganizationInvitation = {
  id: string;
  organizationId: string | null;
  email: string;
  name: string;
  role: string;
  invitedBy: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
  locationId?: string | null;
  departmentId?: string | null;
};

type InviteMemberFormValues = {
  name: string;
  email: string;
  role: string;
  locationId: string;
  departmentId: string;
};

type ManagerScopeRecord = {
  id: string;
  employeeId: string;
  scopeType: "location" | "department";
  scopeId: string;
};

const joinedDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const olderJoinedDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
});

function formatJoinedDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const now = new Date();
  const lastCalendarYearStart = new Date(now.getFullYear() - 1, 0, 1);

  if (date >= lastCalendarYearStart) {
    return joinedDateFormatter.format(date);
  }

  return olderJoinedDateFormatter.format(date);
}

function formatRole(role: string) {
  return role
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getRoleBadgeClassName(role: string) {
  switch (role.toLowerCase()) {
    case "admin":
      return "bg-blue-100 text-blue-800";
    case "manager":
      return "bg-green-100 text-green-800";
    case "employee":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-primary/10 text-primary";
  }
}

function getInitials(name: string, email: string) {
  const source = name.trim() || email.trim();
  const parts = source.split(/\s+|@/).filter(Boolean);

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function scopeLabel(params: {
  locationId?: string | null;
  departmentId?: string | null;
  locationsById: Map<string, string>;
  departmentsById: Map<string, DepartmentRow>;
}): string | null {
  const { locationId, departmentId, departmentsById, locationsById } = params;

  const depMeta = departmentId ? departmentsById.get(departmentId) : undefined;
  if (departmentId && depMeta) {
    const locName = locationsById.get(depMeta.locationId) ?? "";
    const depName = depMeta.name ?? "";
    if (locName && depName) {
      return `${locName} — ${depName}`;
    }
    return depMeta.name ?? "Department scope";
  }

  if (locationId) {
    return locationsById.get(locationId) ?? "Location scope";
  }

  return null;
}

export function SettingsMembersRoute() {
  const { orgname } = useParams();
  const { getAccessTokenSilently } = useAuth0();
  const navigate = useNavigate();
  const { employee, organization, isLoading: meLoading } = useEmployee();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [locationsList, setLocationsList] = useState<LocationRow[]>([]);
  const [departmentsList, setDepartmentsList] = useState<DepartmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [memberFieldEdit, setMemberFieldEdit] = useState<
    null | { member: OrganizationMember; field: "name" | "email" | "role" }
  >(null);
  const [removeMember, setRemoveMember] = useState<OrganizationMember | null>(
    null,
  );
  const [removing, setRemoving] = useState(false);
  const [invitationToRevoke, setInvitationToRevoke] =
    useState<OrganizationInvitation | null>(null);
  const [revoking, setRevoking] = useState(false);

  const [workplaceMember, setWorkplaceMember] =
    useState<OrganizationMember | null>(null);
  const [managerScopesMember, setManagerScopesMember] =
    useState<OrganizationMember | null>(null);
  const [managerScopesRecords, setManagerScopesRecords] = useState<
    ManagerScopeRecord[]
  >([]);
  const [managerScopesLoading, setManagerScopesLoading] = useState(false);
  const [newScopeType, setNewScopeType] = useState<"location" | "department">(
    "location",
  );
  const [newScopeTargetId, setNewScopeTargetId] = useState("");

  const isAdmin = employee?.role === "admin";
  const isManager = employee?.role === "manager";
  const canAccessPage = isAdmin || isManager;
  const canInvite = canAccessPage;

  const locationsById = useMemo(() => {
    const map = new Map<string, string>();
    for (const loc of locationsList) {
      map.set(loc.id, loc.name);
    }
    return map;
  }, [locationsList]);

  const departmentsById = useMemo(() => {
    const map = new Map<string, DepartmentRow>();
    for (const dept of departmentsList) {
      map.set(dept.id, dept);
    }
    return map;
  }, [departmentsList]);

  const {
    handleSubmit,
    register,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<InviteMemberFormValues>({
    defaultValues: {
      name: "",
      email: "",
      role: "employee",
      locationId: "",
      departmentId: "",
    },
  });

  const inviteRole = watch("role");
  const inviteLocationId = watch("locationId");
  const inviteDepartmentId = watch("departmentId");

  const filteredDepartments = useMemo(() => {
    return departmentsList.filter((d) =>
      !inviteLocationId || d.locationId === inviteLocationId
    );
  }, [departmentsList, inviteLocationId]);

  const {
    register: registerMemberField,
    handleSubmit: handleMemberFieldSubmit,
    reset: resetMemberField,
    formState: {
      errors: memberFieldErrors,
      isSubmitting: isMemberFieldSubmitting,
    },
  } = useForm<{ value: string }>({
    values: memberFieldEdit
      ? {
          value:
            memberFieldEdit.field === "name"
              ? memberFieldEdit.member.name
              : memberFieldEdit.field === "email"
                ? memberFieldEdit.member.email
                : memberFieldEdit.member.role,
        }
      : { value: "" },
  });

  const {
    handleSubmit: handleWorkplaceSubmit,
    reset: resetWorkplace,
    register: registerWorkplace,
    watch: watchWorkplace,
    formState: { isSubmitting: isWorkplaceSubmitting },
  } = useForm<{ locationId: string; departmentId: string }>({
    defaultValues: { locationId: "", departmentId: "" },
  });

  function resetWorkplaceFormValues(member: OrganizationMember) {
    resetWorkplace({
      locationId: member.locationId ?? "",
      departmentId: member.departmentId ?? "",
    });
  }

  const workplaceLocationId = watchWorkplace("locationId");

  const workplaceDepartments = useMemo(
    () =>
      departmentsList.filter(
        (d) =>
          !workplaceLocationId || d.locationId === workplaceLocationId,
      ),
    [departmentsList, workplaceLocationId],
  );

  const loadRoster = useCallback(
    async (signal?: AbortSignal) => {
      if (!organization) {
        throw new Error("No organization.");
      }
      const organizationId = organization.id;
      const accessToken = await getAccessTokenSilently();
      const authHeaders = { authorization: `Bearer ${accessToken}` };
      const base = `${apiBaseUrl}/api/v1`;

      const [membersResponse, invitationsResponse, locResponse, deptResponse] =
        await Promise.all([
          fetch(`${base}/employees/org/${organizationId}`, {
            headers: authHeaders,
            signal,
          }),
          fetch(`${base}/organizations/${organizationId}/invitations`, {
            headers: authHeaders,
            signal,
          }),
          fetch(`${base}/organizations/${organizationId}/locations`, {
            headers: authHeaders,
            signal,
          }),
          fetch(`${base}/organizations/${organizationId}/departments`, {
            headers: authHeaders,
            signal,
          }),
        ]);

      if (!membersResponse.ok) {
        const body = await membersResponse.json().catch(() => null);
        throw new Error(
          body?.error ?? "Could not load organization members.",
        );
      }

      if (!invitationsResponse.ok) {
        const body = await invitationsResponse.json().catch(() => null);
        throw new Error(body?.error ?? "Could not load invitations.");
      }

      if (!locResponse.ok) {
        const body = await locResponse.json().catch(() => null);
        throw new Error(body?.error ?? "Could not load locations.");
      }

      if (!deptResponse.ok) {
        const body = await deptResponse.json().catch(() => null);
        throw new Error(body?.error ?? "Could not load departments.");
      }

      return {
        members: (await membersResponse.json()) as OrganizationMember[],
        invitations: (await invitationsResponse.json()) as OrganizationInvitation[],
        locationsList: (await locResponse.json()) as LocationRow[],
        departmentsList: (await deptResponse.json()) as DepartmentRow[],
      };
    },
    [getAccessTokenSilently, isAdmin, organization],
  );

  async function refreshRosterQuiet() {
    try {
      const data = await loadRoster();
      setMembers(data.members);
      setInvitations(data.invitations);
      setLocationsList(data.locationsList);
      setDepartmentsList(data.departmentsList);
    } catch {
      toast.error("Could not refresh the member list.");
    }
  }

  useEffect(() => {
    if (!organization || !canAccessPage) {
      setIsLoading(false);
      return;
    }

    const abortController = new AbortController();

    async function run() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await loadRoster(abortController.signal);
        if (!abortController.signal.aborted) {
          setMembers(data.members);
          setInvitations(data.invitations);
          setLocationsList(data.locationsList);
          setDepartmentsList(data.departmentsList);
        }
      } catch (unknownError) {
        if (abortController.signal.aborted) {
          return;
        }

        setError(
          unknownError instanceof Error
            ? unknownError.message
            : "Could not load organization members.",
        );
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void run();

    return () => {
      abortController.abort();
    };
  }, [canAccessPage, loadRoster, organization]);

  /** When inviting to a narrower location, reset department when it falls outside. */
  useEffect(() => {
    const depMeta = departmentsById.get(inviteDepartmentId);
    if (inviteDepartmentId && depMeta?.locationId !== inviteLocationId) {
      setValue("departmentId", "");
    }
  }, [inviteDepartmentId, inviteLocationId, departmentsById, setValue]);

  async function loadScopesForEmployee(emp: OrganizationMember) {
    if (!organization || !isAdmin) {
      return;
    }
    setManagerScopesLoading(true);

    try {
      const token = await getAccessTokenSilently();
      const [scopesRes, locRes, depRes] = await Promise.all([
        fetch(
          `${apiBaseUrl}/api/v1/organizations/${organization.id}/employees/${emp.id}/manager-scopes`,
          { headers: { authorization: `Bearer ${token}` } },
        ),
        fetch(
          `${apiBaseUrl}/api/v1/organizations/${organization.id}/locations`,
          { headers: { authorization: `Bearer ${token}` } },
        ),
        fetch(
          `${apiBaseUrl}/api/v1/organizations/${organization.id}/departments`,
          { headers: { authorization: `Bearer ${token}` } },
        ),
      ]);

      const sBody = await scopesRes.json().catch(() => null);
      const lBody = await locRes.json().catch(() => null);
      const dBody = await depRes.json().catch(() => null);

      if (!scopesRes.ok) {
        throw new Error(
          typeof sBody?.error === "string"
            ? sBody.error
            : "Could not load manager scopes.",
        );
      }
      if (!locRes.ok || !depRes.ok) {
        throw new Error("Could not load organization resources.");
      }

      const records = Array.isArray(sBody)
        ? (sBody as ManagerScopeRecord[]).filter(
            (x) =>
              x?.id &&
              x.scopeId &&
              (x.scopeType === "location" || x.scopeType === "department"),
          )
        : [];

      setManagerScopesRecords(records);
      setLocationsList(lBody as LocationRow[]);
      setDepartmentsList(dBody as DepartmentRow[]);

      const firstTypeDefault = (): "location" | "department" =>
        (lBody as LocationRow[])?.length ? "location" : "department";

      const defType =
        records[0]?.scopeType === "location" ||
        records[0]?.scopeType === "department"
          ? records[0].scopeType
          : firstTypeDefault();
      setNewScopeType(defType);
      setNewScopeTargetId("");
    } catch (unknownError) {
      toast.error(
        unknownError instanceof Error
          ? unknownError.message
          : "Could not load scopes.",
      );
      setManagerScopesMember(null);
    } finally {
      setManagerScopesLoading(false);
    }
  }

  useEffect(() => {
    if (managerScopesMember && isAdmin) {
      void loadScopesForEmployee(managerScopesMember);
    }
  }, [managerScopesMember, isAdmin, organization?.id]);

  async function submitNewScopeAssignment() {
    if (!organization || !managerScopesMember || newScopeTargetId === "") {
      toast.error("Choose a scope to assign.");
      return;
    }

    try {
      const token = await getAccessTokenSilently();
      const res = await fetch(
        `${apiBaseUrl}/api/v1/organizations/${organization.id}/manager-scopes`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            employeeId: managerScopesMember.id,
            scopeType: newScopeType,
            scopeId: newScopeTargetId,
          }),
        },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : "Could not assign scope.",
        );
      }
      toast.success("Scope assigned.");
      await loadScopesForEmployee(managerScopesMember);
      await refreshRosterQuiet();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not assign scope.");
    }
  }

  async function revokeScopeRecord(recordId: string) {
    if (!organization || !managerScopesMember) {
      return;
    }

    try {
      const token = await getAccessTokenSilently();
      const res = await fetch(
        `${apiBaseUrl}/api/v1/organizations/${organization.id}/manager-scopes/${recordId}`,
        {
          method: "DELETE",
          headers: { authorization: `Bearer ${token}` },
        },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : "Could not remove scope.",
        );
      }
      toast.success("Scope removed.");
      await loadScopesForEmployee(managerScopesMember);
      await refreshRosterQuiet();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove scope.");
    }
  }

  const sortedMembers = useMemo(
    () =>
      [...members].sort((first, second) =>
        first.name.localeCompare(second.name, undefined, {
          sensitivity: "base",
        }),
      ),
    [members],
  );

  const sortedInvitations = useMemo(
    () =>
      [...invitations].sort((first, second) =>
        first.email.localeCompare(second.email, undefined, {
          sensitivity: "base",
        }),
      ),
    [invitations],
  );

  const newScopeOptions = useMemo((): Array<{ id: string; name: string }> => {
    if (newScopeType === "location") {
      return locationsList;
    }
    return departmentsList;
  }, [newScopeType, locationsList, departmentsList]);

  if (meLoading) {
    return (
      <div className="text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!employee || !canAccessPage) {
    return (
      <Navigate to={`/${orgname ?? ""}/settings/profile`} replace />
    );
  }

  function scopeResolvedName(record: ManagerScopeRecord): string {
    if (record.scopeType === "location") {
      return locationsById.get(record.scopeId) ?? record.scopeId;
    }
    return departmentsById.get(record.scopeId)?.name ?? record.scopeId;
  }

  async function onInviteSubmit(values: InviteMemberFormValues) {
    if (!organization || !canInvite) {
      toast.error("You cannot invite members.");
      return;
    }

    const loc = values.locationId.trim();
    const dep = values.departmentId.trim();

    const inviterNeedsTarget =
      isManager ||
      (!isAdmin &&
        values.role === "manager" &&
        !(loc || dep));

    if (inviterNeedsTarget && !loc && !dep) {
      setInviteError(
        isManager
          ? "Choose a location or department for this invite."
          : "Manager invitations need a location or department.",
      );
      toast.error(
        isManager
          ? "Choose a location or department for this invite."
          : "Manager invitations need a location or department.",
      );
      return;
    }

    setInviteError(null);

    try {
      const accessToken = await getAccessTokenSilently();
      const payload: Record<string, unknown> = {
        name: values.name.trim(),
        email: values.email.trim(),
        role: values.role,
      };

      if (loc) {
        payload.locationId = loc;
      }
      if (dep) {
        payload.departmentId = dep;
      }

      const response = await fetch(
        `${apiBaseUrl}/api/v1/organizations/${organization.id}/invitations`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Could not invite member.");
      }

      await response.json().catch(() => null);
      reset({
        name: "",
        email: "",
        role: "employee",
        locationId: "",
        departmentId: "",
      });
      setIsInviteDialogOpen(false);
      toast.success("Invitation created.");
      await refreshRosterQuiet();
    } catch (unknownError) {
      const message =
        unknownError instanceof Error
          ? unknownError.message
          : "Could not invite member.";
      setInviteError(message);
      toast.error(message);
    }
  }

  async function submitMemberField(values: { value: string }) {
    if (!memberFieldEdit || !organization) {
      return;
    }

    const { member, field } = memberFieldEdit;
    const nextValue = values.value.trim();
    if (field !== "role" && nextValue === "") {
      toast.error("Value is required.");
      return;
    }

    try {
      const accessToken = await getAccessTokenSilently();
      const body: {
        id: string;
        name?: string;
        email?: string;
        role?: string;
      } = { id: member.id };

      if (field === "name") {
        body.name = nextValue;
      } else if (field === "email") {
        body.email = nextValue;
      } else {
        body.role = values.value;
      }

      const response = await fetch(`${apiBaseUrl}/api/v1/employee/update`, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const responseBody = await response.json().catch(() => null);
        throw new Error(responseBody?.error ?? "Could not update member.");
      }

      toast.success("Member updated.");
      setMemberFieldEdit(null);
      resetMemberField();
      await refreshRosterQuiet();
    } catch (unknownError) {
      toast.error(
        unknownError instanceof Error
          ? unknownError.message
          : "Could not update member.",
      );
    }
  }

  async function submitWorkplace(payload: {
    locationId: string;
    departmentId: string;
  }) {
    if (!workplaceMember || !organization) {
      return;
    }

    const loc = payload.locationId.trim();
    const dep = payload.departmentId.trim();

    const body: Record<string, unknown> = { id: workplaceMember.id };
    body.locationId = loc === "" ? null : loc;
    body.departmentId = dep === "" ? null : dep;

    try {
      const token = await getAccessTokenSilently();
      const res = await fetch(`${apiBaseUrl}/api/v1/employee/update`, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(typeof j?.error === "string" ? j.error : "Update failed.");
      }
      toast.success("Worksite updated.");
      setWorkplaceMember(null);
      resetWorkplace({
        locationId: "",
        departmentId: "",
      });
      await refreshRosterQuiet();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update worksite.");
    }
  }

  async function confirmRemoveMember() {
    if (!removeMember || !organization) {
      return;
    }

    setRemoving(true);

    try {
      const accessToken = await getAccessTokenSilently();
      const response = await fetch(`${apiBaseUrl}/api/v1/employee/remove`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ id: removeMember.id }),
      });

      if (!response.ok) {
        const responseBody = await response.json().catch(() => null);
        throw new Error(responseBody?.error ?? "Could not remove member.");
      }

      toast.success("Member removed.");
      setRemoveMember(null);
      await refreshRosterQuiet();
    } catch (unknownError) {
      toast.error(
        unknownError instanceof Error
          ? unknownError.message
          : "Could not remove member.",
      );
    } finally {
      setRemoving(false);
    }
  }

  async function confirmRevokeInvitation() {
    if (!invitationToRevoke || !organization) {
      return;
    }

    setRevoking(true);

    try {
      const accessToken = await getAccessTokenSilently();
      const response = await fetch(
        `${apiBaseUrl}/api/v1/organizations/${organization.id}/invitations/${invitationToRevoke.id}/revoke`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) {
        const responseBody = await response.json().catch(() => null);
        throw new Error(responseBody?.error ?? "Could not revoke invitation.");
      }

      toast.success("Invitation revoked.");
      setInvitationToRevoke(null);
      await refreshRosterQuiet();
    } catch (unknownError) {
      toast.error(
        unknownError instanceof Error
          ? unknownError.message
          : "Could not revoke invitation.",
      );
    } finally {
      setRevoking(false);
    }
  }

  async function resendInvitation(invitation: OrganizationInvitation) {
    if (!organization) {
      return;
    }

    try {
      const accessToken = await getAccessTokenSilently();
      const response = await fetch(
        `${apiBaseUrl}/api/v1/organizations/${organization.id}/invitations/${invitation.id}/resend`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) {
        const responseBody = await response.json().catch(() => null);
        throw new Error(responseBody?.error ?? "Could not resend invitation.");
      }

      toast.success("Invitation updated.");
      await refreshRosterQuiet();
    } catch (unknownError) {
      toast.error(
        unknownError instanceof Error
          ? unknownError.message
          : "Could not resend invitation.",
      );
    }
  }

  return (
    <section className="w-full max-w-full">
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col mx-4">
            <h1 className="text-xl font-medium tracking-tight">Members</h1>
            {isManager && !isAdmin && (
              <p className="mt-1 text-sm text-muted-foreground">
                You can view people in your scope and send or rescind invites
                for your locations and departments.
              </p>
            )}
          </div>
          {canInvite && (
            <Button size="sm" onClick={() => setIsInviteDialogOpen(true)}>
              Add person
            </Button>
          )}
        </div>

        <div className="w-full rounded-xl bg-card text-sm [&_table_td]:py-2 [&_table_th]:h-auto [&_table_th]:py-2 [&_table_th]:px-4 [&_table_td]:px-4">
          <Table className="table-fixed border-separate border-spacing-x-0 border-spacing-y-0.5 [&_tr[data-roster-row]>td]:transition-colors [&_tr[data-roster-row]>td:first-child]:rounded-l-lg [&_tr[data-roster-row]>td:last-child]:rounded-r-lg [&_tr[data-roster-row]:hover>td]:bg-muted/25">
            <TableHeader className="hover:bg-transparent border-0">
              <TableRow className="hover:bg-transparent border-0">
                <TableHead className="border-0 w-[20%]">Name</TableHead>
                <TableHead className="border-0 w-[32%]">Email</TableHead>
                <TableHead className="border-0 w-[14%] text-right">
                  Status
                </TableHead>
                <TableHead className="border-0 w-[18%] text-right">
                  Worksite
                </TableHead>
                <TableHead className="border-0 w-[96px] text-right">
                  Joined
                </TableHead>
                <TableHead className="border-0 w-[52px] text-right">
                  <span className="sr-only">Member menu</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-muted-foreground"
                  >
                    Loading members...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-destructive"
                  >
                    {error}
                  </TableCell>
                </TableRow>
              ) : sortedMembers.length === 0 &&
                sortedInvitations.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No members found.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  <TableRow className="border-b-0 hover:bg-transparent [&>td]:p-2">
                    <TableCell
                      colSpan={6}
                      className="rounded-lg bg-muted/60 px-4 py-1.5 font-medium text-muted-foreground"
                    >
                      Active{" "}
                      <span className="text-muted-foreground/70">
                        {sortedMembers.length}
                      </span>
                    </TableCell>
                  </TableRow>
                  {sortedMembers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-10 text-center text-muted-foreground"
                      >
                        No active members found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedMembers.map((member) => {
                      const worksite = scopeLabel({
                        locationId: member.locationId,
                        departmentId: member.departmentId,
                        locationsById,
                        departmentsById,
                      });
                      return (
                        <TableRow
                          key={member.id}
                          data-roster-row=""
                          className="hover:bg-transparent"
                        >
                          <TableCell className="min-w-0">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-7 w-7 text-xs shrink-0 items-center justify-center rounded-full bg-blue-50 text-black">
                                {getInitials(member.name, member.email)}
                              </div>
                              <span className="min-w-0 truncate">
                                {member.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="truncate text-muted-foreground">
                            {member.email}
                          </TableCell>
                          <TableCell className="min-w-0 text-right">
                            <span
                              className={`inline-flex max-w-full truncate rounded-md px-2 py-1 ${getRoleBadgeClassName(member.role)}`}
                            >
                              {formatRole(member.role)}
                            </span>
                          </TableCell>
                          <TableCell className="truncate text-right text-muted-foreground text-sm">
                            {worksite ?? "—"}
                          </TableCell>
                          <TableCell className="truncate text-right text-muted-foreground">
                            {formatJoinedDate(member.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            {isAdmin && employee?.id !== member.id ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-8"
                                  >
                                    <IconDots className="size-4 text-muted-foreground" />
                                    <span className="sr-only">Open menu</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      setMemberFieldEdit({
                                        member,
                                        field: "name",
                                      })
                                    }
                                  >
                                    Update name
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      setMemberFieldEdit({
                                        member,
                                        field: "email",
                                      })
                                    }
                                  >
                                    Update email
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      setMemberFieldEdit({
                                        member,
                                        field: "role",
                                      })
                                    }
                                  >
                                    Update role
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      setWorkplaceMember(member);
                                      resetWorkplaceFormValues(member);
                                    }}
                                  >
                                    Set worksite
                                  </DropdownMenuItem>
                                  {member.role === "manager" && (
                                    <DropdownMenuItem
                                      onSelect={() =>
                                        setManagerScopesMember(member)
                                      }
                                    >
                                      Manager access
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      navigate(
                                        `/${organization?.slug}/settings/availability?employeeId=${member.id}`,
                                      )
                                    }
                                  >
                                    Update availability
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onSelect={() => setRemoveMember(member)}
                                  >
                                    Remove person
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}

                  {sortedInvitations.length > 0 && (
                    <>
                      <TableRow className="border-0 hover:bg-transparent [&>td]:p-2">
                        <TableCell
                          colSpan={6}
                          className="rounded-lg bg-muted/60 px-4 py-1.5 font-medium text-muted-foreground border-0"
                        >
                          Invited{" "}
                          <span className="text-muted-foreground/70">
                            {sortedInvitations.length}
                          </span>
                        </TableCell>
                      </TableRow>
                      {sortedInvitations.map((invitation) => {
                        const invScope = scopeLabel({
                          locationId: invitation.locationId,
                          departmentId: invitation.departmentId,
                          locationsById,
                          departmentsById,
                        });

                        const canOperateInvite =
                          isAdmin ||
                          (isManager &&
                            (!!invitation.locationId ||
                              !!invitation.departmentId));

                        return (
                          <TableRow
                            key={invitation.id}
                            data-roster-row=""
                            className="hover:bg-transparent"
                          >
                            <TableCell className="min-w-0">
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-7 w-7 text-xs shrink-0 items-center justify-center rounded-full border border-dashed text-muted-foreground">
                                  {getInitials(
                                    invitation.name,
                                    invitation.email,
                                  )}
                                </div>
                                <span className="min-w-0 truncate">
                                  {invitation.name || invitation.email}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="truncate text-muted-foreground">
                              {invitation.email}
                            </TableCell>
                            <TableCell className="min-w-0 text-right">
                              <span
                                className={`inline-flex max-w-full truncate rounded-md px-2 py-1 ${getRoleBadgeClassName(invitation.role)}`}
                              >
                                {formatRole(invitation.role)} (Invited)
                              </span>
                            </TableCell>
                            <TableCell className="truncate text-right text-muted-foreground text-md">
                              {invScope ?? "—"}
                            </TableCell>
                            <TableCell className="truncate text-right text-muted-foreground">
                              {formatJoinedDate(invitation.createdAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              {canInvite && canOperateInvite ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="size-8"
                                    >
                                      <IconDots className="size-4 text-muted-foreground" />
                                      <span className="sr-only">Open menu</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onSelect={() => {
                                        void resendInvitation(invitation);
                                      }}
                                    >
                                      Resend invite
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onSelect={() =>
                                        setInvitationToRevoke(invitation)
                                      }
                                    >
                                      Revoke access
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog
        open={isInviteDialogOpen}
        onOpenChange={(open) => {
          setIsInviteDialogOpen(open);
          if (!open) {
            setInviteError(null);
            reset({
              name: "",
              email: "",
              role: "employee",
              locationId: "",
              departmentId: "",
            });
          }
        }}
      >
        <DialogContent>
          <form onSubmit={handleSubmit(onInviteSubmit)}>
            <DialogHeader>
              <DialogTitle>Add person</DialogTitle>
              <DialogDescription>
                Invite a new member to join your organization.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="invite-name">Name</Label>
                <Input
                  id="invite-name"
                  placeholder="Jane Doe"
                  disabled={isSubmitting}
                  {...register("name", {
                    required: "Name is required",
                    validate: (value) =>
                      value.trim().length > 0 || "Name is required",
                  })}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="jane@example.com"
                  disabled={isSubmitting}
                  {...register("email", {
                    required: "Email is required",
                    validate: (value) =>
                      value.trim().length > 0 || "Email is required",
                  })}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="invite-role">Role</Label>
                <select
                  id="invite-role"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSubmitting}
                  {...register("role")}
                >
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  {isAdmin && <option value="admin">Admin</option>}
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="invite-location">Location (optional)</Label>
                <select
                  id="invite-location"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSubmitting}
                  {...register("locationId")}
                >
                  <option value="">—</option>
                  {locationsList.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="invite-department">Department (optional)</Label>
                <select
                  id="invite-department"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSubmitting}
                  {...register("departmentId")}
                >
                  <option value="">—</option>
                  {filteredDepartments.map((dep) => (
                    <option key={dep.id} value={dep.id}>
                      {dep.name}
                    </option>
                  ))}
                </select>
              </div>

              {isManager && (
                <p className="text-xs text-muted-foreground">
                  Manager invites must include a location or department you
                  cover.
                </p>
              )}

              {inviteRole === "manager" && isAdmin && (
                <p className="text-xs text-muted-foreground">
                  Manager invites should include a location or department unless
                  you intend an organization-wide manager.
                </p>
              )}

              {inviteError && (
                <p className="text-sm text-destructive">{inviteError}</p>
              )}
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => setIsInviteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Inviting..." : "Send invitation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={memberFieldEdit !== null}
        onOpenChange={(open) => {
          if (!open) {
            setMemberFieldEdit(null);
            resetMemberField();
          }
        }}
      >
        <DialogContent>
          <form
            onSubmit={handleMemberFieldSubmit((data) =>
              void submitMemberField(data)
            )}
          >
            <DialogHeader>
              <DialogTitle>
                {memberFieldEdit?.field === "name"
                  ? "Update name"
                  : memberFieldEdit?.field === "email"
                    ? "Update email"
                    : "Update role"}
              </DialogTitle>
              <DialogDescription>
                {memberFieldEdit?.member.name} ({memberFieldEdit?.member.email})
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 grid gap-2">
              {memberFieldEdit?.field === "role" ? (
                <select
                  id="member-field-value"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isMemberFieldSubmitting}
                  {...registerMemberField("value", { required: true })}
                >
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              ) : (
                <Input
                  id="member-field-value"
                  type={
                    memberFieldEdit?.field === "email" ? "email" : "text"
                  }
                  disabled={isMemberFieldSubmitting}
                  {...registerMemberField("value", {
                    required: "This field is required",
                    validate: (v) =>
                      v.trim().length > 0 || "This field is required",
                  })}
                />
              )}
              {memberFieldErrors.value && (
                <p className="text-xs text-destructive">
                  {memberFieldErrors.value.message}
                </p>
              )}
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                disabled={isMemberFieldSubmitting}
                onClick={() => setMemberFieldEdit(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isMemberFieldSubmitting}>
                {isMemberFieldSubmitting ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={removeMember !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveMember(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove person</DialogTitle>
            <DialogDescription>
              Remove{" "}
              <span className="font-medium text-foreground">
                {removeMember?.name}
              </span>{" "}
              from the organization? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={removing}
              onClick={() => setRemoveMember(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={removing}
              onClick={() => void confirmRemoveMember()}
            >
              {removing ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={invitationToRevoke !== null}
        onOpenChange={(open) => {
          if (!open) {
            setInvitationToRevoke(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke access</DialogTitle>
            <DialogDescription>
              Revoke the pending invitation for{" "}
              <span className="font-medium text-foreground">
                {invitationToRevoke?.email}
              </span>
              ? They will no longer be able to join with this invite.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={revoking}
              onClick={() => setInvitationToRevoke(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={revoking}
              onClick={() => void confirmRevokeInvitation()}
            >
              {revoking ? "Revoking..." : "Revoke"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={workplaceMember !== null}
        onOpenChange={(open) => {
          if (!open) {
            setWorkplaceMember(null);
            resetWorkplace({ locationId: "", departmentId: "" });
          }
        }}
      >
        <DialogContent>
          <form
            onSubmit={handleWorkplaceSubmit((data) =>
              void submitWorkplace(data)
            )}
          >
            <DialogHeader>
              <DialogTitle>Set worksite</DialogTitle>
              <DialogDescription>
                Primary location and department for{" "}
                <span className="font-medium text-foreground">
                  {workplaceMember?.name}
                </span>
                .
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="wp-loc">Location</Label>
                <select
                  id="wp-loc"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
                  disabled={
                    isWorkplaceSubmitting ||
                    workplaceMember === null ||
                    locationsList.length === 0
                  }
                  {...registerWorkplace("locationId")}
                >
                  <option value="">— none —</option>
                  {locationsList.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="wp-dep">Department</Label>
                <select
                  id="wp-dep"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
                  disabled={isWorkplaceSubmitting || workplaceMember === null}
                  {...registerWorkplace("departmentId")}
                >
                  <option value="">— none —</option>
                  {workplaceDepartments.map((dep) => (
                    <option key={dep.id} value={dep.id}>
                      {dep.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter className="mt-4 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                disabled={isWorkplaceSubmitting}
                onClick={() => setWorkplaceMember(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isWorkplaceSubmitting}>
                {isWorkplaceSubmitting ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={managerScopesMember !== null}
        onOpenChange={(open) => {
          if (!open) {
            setManagerScopesMember(null);
            setManagerScopesRecords([]);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Manager access</DialogTitle>
            <DialogDescription>
              Assign where{" "}
              <span className="font-medium text-foreground">
                {managerScopesMember?.name}
              </span>{" "}
              can manage people and schedules.
            </DialogDescription>
          </DialogHeader>

          {managerScopesLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="rounded-md border">
                <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                  Current scopes
                </div>
                {managerScopesRecords.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">
                    No scopes yet. This manager cannot see anyone until you
                    assign at least one location or department.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {managerScopesRecords.map((row) => (
                      <li
                        key={row.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                      >
                        <span>
                          <span className="text-muted-foreground">
                            {row.scopeType === "location"
                              ? "Location"
                              : "Department"}
                            :
                          </span>{" "}
                          {scopeResolvedName(row)}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void revokeScopeRecord(row.id)}
                        >
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="grid gap-3 rounded-md border p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Add scope
                </p>
                <div className="grid gap-2">
                  <Label htmlFor="scope-type">Type</Label>
                  <select
                    id="scope-type"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={newScopeType}
                    onChange={(e) => {
                      setNewScopeType(
                        e.target.value as typeof newScopeType,
                      );
                      setNewScopeTargetId("");
                    }}
                  >
                    <option value="location">Location</option>
                    <option value="department">Department</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="scope-target">Resource</Label>
                  <select
                    id="scope-target"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={newScopeTargetId}
                    onChange={(e) => setNewScopeTargetId(e.target.value)}
                  >
                    <option value="">— select —</option>
                    {newScopeOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => void submitNewScopeAssignment()}
                >
                  Assign scope
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setManagerScopesMember(null)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
