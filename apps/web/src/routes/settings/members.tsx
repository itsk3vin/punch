import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
  const { employee, organization } = useEmployee();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
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

  useEffect(() => {
    if (!organization) {
      setIsLoading(false);
      return;
    }

    const organizationId = organization.id;
    const abortController = new AbortController();

    async function loadMembers() {
      setIsLoading(true);
      setError(null);

      try {
        const accessToken = await getAccessTokenSilently();
        const membersResponse = await fetch(
          `${apiBaseUrl}/api/v1/employees/org/${organizationId}`,
          {
            headers: {
              authorization: `Bearer ${accessToken}`,
            },
            signal: abortController.signal,
          },
        );
        const invitationsResponse = await fetch(
          `${apiBaseUrl}/api/v1/organizations/${organizationId}/invitations`,
          {
            headers: {
              authorization: `Bearer ${accessToken}`,
            },
            signal: abortController.signal,
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

        setMembers((await membersResponse.json()) as OrganizationMember[]);
        setInvitations(
          (await invitationsResponse.json()) as OrganizationInvitation[],
        );
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

    void loadMembers();

    return () => {
      abortController.abort();
    };
  }, [getAccessTokenSilently, organization]);

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

      const invitation = (await response.json()) as OrganizationInvitation;
      setInvitations((currentInvitations) => [
        invitation,
        ...currentInvitations,
      ]);
      reset();
      setIsInviteDialogOpen(false);
      toast.success("Invitation created.");
    } catch (unknownError) {
      const message =
        unknownError instanceof Error
          ? unknownError.message
          : "Could not invite member.";
      setInviteError(message);
      toast.error(message);
    }
  }

  return (
    <section className="mx-auto w-[760px] max-w-full">
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-medium tracking-tight">Members</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              View everyone who belongs to your organization.
            </p>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => setIsInviteDialogOpen(true)}>
              Add person
            </Button>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border bg-card text-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Loading members...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-destructive"
                  >
                    {error}
                  </TableCell>
                </TableRow>
              ) : sortedMembers.length === 0 &&
                sortedInvitations.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No members found.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableCell
                      colSpan={4}
                      className="h-11 font-medium text-muted-foreground"
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
                        colSpan={4}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No active members found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                              {getInitials(member.name, member.email)}
                            </div>
                            <span className="font-medium">{member.name}</span>
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
                      </TableRow>
                    ))
                  )}

                  {sortedInvitations.length > 0 && (
                    <>
                      <TableRow className="bg-muted/60 hover:bg-muted/60">
                        <TableCell
                          colSpan={4}
                          className="h-11 font-medium text-muted-foreground"
                        >
                          Invited{" "}
                          <span className="text-muted-foreground/70">
                            {sortedInvitations.length}
                          </span>
                        </TableCell>
                      </TableRow>
                      {sortedInvitations.map((invitation) => (
                        <TableRow key={invitation.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed text-xs font-medium text-muted-foreground">
                                {getInitials(invitation.name, invitation.email)}
                              </div>
                              <span className="font-medium">
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
    </section>
  );
}
