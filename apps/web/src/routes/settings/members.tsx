import { IconDots } from "@tabler/icons-react";
import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
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

type OrganizationMember = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
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
};

type InviteMemberFormValues = {
  name: string;
  email: string;
  role: string;
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

function getInitials(name: string, email: string) {
  const source = name.trim() || email.trim();
  const parts = source.split(/\s+|@/).filter(Boolean);

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function SettingsMembersRoute() {
  const { getAccessTokenSilently } = useAuth0();
  const navigate = useNavigate();
  const { employee, organization } = useEmployee();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
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
  const isAdmin = employee?.role === "admin";
  const {
    handleSubmit,
    register,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteMemberFormValues>({
    defaultValues: {
      name: "",
      email: "",
      role: "employee",
    },
  });

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

  const loadRoster = useCallback(
    async (signal?: AbortSignal) => {
      if (!organization) {
        throw new Error("No organization.");
      }
      const organizationId = organization.id;
      const accessToken = await getAccessTokenSilently();
      const membersResponse = await fetch(
        `${apiBaseUrl}/api/v1/employees/org/${organizationId}`,
        {
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
          signal,
        },
      );
      const invitationsResponse = await fetch(
        `${apiBaseUrl}/api/v1/organizations/${organizationId}/invitations`,
        {
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
          signal,
        },
      );

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

      return {
        members: (await membersResponse.json()) as OrganizationMember[],
        invitations: (await invitationsResponse.json()) as OrganizationInvitation[],
      };
    },
    [getAccessTokenSilently, organization],
  );

  async function refreshRosterQuiet() {
    try {
      const data = await loadRoster();
      setMembers(data.members);
      setInvitations(data.invitations);
    } catch {
      toast.error("Could not refresh the member list.");
    }
  }
  useEffect(() => {
    if (!organization) {
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
  }, [loadRoster, organization]);

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

  async function onInviteSubmit(values: InviteMemberFormValues) {
    if (!organization || !isAdmin) {
      toast.error("Only organization admins can invite members.");
      return;
    }

    setInviteError(null);

    try {
      const accessToken = await getAccessTokenSilently();
      const response = await fetch(
        `${apiBaseUrl}/api/v1/organizations/${organization.id}/invitations`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            name: values.name.trim(),
            email: values.email.trim(),
            role: values.role,
          }),
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Could not invite member.");
      }

      await response.json().catch(() => null);
      reset();
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
          <div>
            <h1 className="text-xl font-medium tracking-tight">Members</h1>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => setIsInviteDialogOpen(true)}>
              Add person
            </Button>
          )}
        </div>

        <div className="w-full rounded-xl bg-card text-sm [&_table_td]:py-2 [&_table_th]:h-auto [&_table_th]:py-2 [&_table_th]:px-4 [&_table_td]:px-4">
          <Table className="border-separate border-spacing-x-0 border-spacing-y-0.5 [&_tr[data-roster-row]>td]:transition-colors [&_tr[data-roster-row]>td:first-child]:rounded-l-lg [&_tr[data-roster-row]>td:last-child]:rounded-r-lg [&_tr[data-roster-row]:hover>td]:bg-muted/25">
            <TableHeader className="hover:bg-transparent border-0">
              <TableRow className="hover:bg-transparent border-0">
                <TableHead className="border-0">Name</TableHead>
                <TableHead className="border-0">Email</TableHead>
                <TableHead className="border-0">Status</TableHead>
                <TableHead className="border-0 text-right">Joined</TableHead>
                <TableHead className="border-0 w-[52px] text-right">
                  <span className="sr-only">Member menu</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-muted-foreground"
                  >
                    Loading members...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-destructive"
                  >
                    {error}
                  </TableCell>
                </TableRow>
              ) : sortedMembers.length === 0 &&
                sortedInvitations.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No members found.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  <TableRow className="border-b-0 hover:bg-transparent [&>td]:p-2">
                    <TableCell
                      colSpan={5}
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
                        colSpan={5}
                        className="py-10 text-center text-muted-foreground"
                      >
                        No active members found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedMembers.map((member) => (
                      <TableRow
                        key={member.id}
                        data-roster-row=""
                        className="hover:bg-transparent"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-7 w-7 text-xs shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              {getInitials(member.name, member.email)}
                            </div>
                            <span className="">{member.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {member.email}
                        </TableCell>
                        <TableCell>
                          <span className="rounded-md bg-primary/10 px-2 py-1 text-primary">
                            {formatRole(member.role)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
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
                    ))
                  )}

                  {sortedInvitations.length > 0 && (
                    <>
                      <TableRow className="border-0 hover:bg-transparent [&>td]:p-2">
                        <TableCell
                          colSpan={5}
                          className="rounded-lg bg-muted/60 px-4 py-1.5 font-medium text-muted-foreground border-0"
                        >
                          Invited{" "}
                          <span className="text-muted-foreground/70">
                            {sortedInvitations.length}
                          </span>
                        </TableCell>
                      </TableRow>
                      {sortedInvitations.map((invitation) => (
                        <TableRow
                          key={invitation.id}
                          data-roster-row=""
                          className="hover:bg-transparent"
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-7 w-7 text-xs shrink-0 items-center justify-center rounded-full border border-dashed text-muted-foreground">
                                {getInitials(invitation.name, invitation.email)}
                              </div>
                              <span className="">
                                {invitation.name || invitation.email}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {invitation.email}
                          </TableCell>
                          <TableCell>
                            <span className="rounded-md bg-primary/10 px-2 py-1 text-primary">
                              {formatRole(invitation.role)} (Invited)
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatJoinedDate(invitation.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            {isAdmin ? (
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
                      ))}
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
            reset();
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
                  <option value="admin">Admin</option>
                </select>
              </div>

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
            onSubmit={handleMemberFieldSubmit((data) => void submitMemberField(data))}
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
    </section>
  );
}
