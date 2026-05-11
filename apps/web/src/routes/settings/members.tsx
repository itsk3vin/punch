import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useMemo, useState } from "react";

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

export function SettingsMembersRoute() {
  const { getAccessTokenSilently } = useAuth0();
  const { organization } = useEmployee();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        const response = await fetch(
          `${apiBaseUrl}/api/v1/employees/org/${organizationId}`,
          {
            headers: {
              authorization: `Bearer ${accessToken}`,
            },
            signal: abortController.signal,
          },
        );

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error ?? "Could not load organization members.");
        }

        setMembers((await response.json()) as OrganizationMember[]);
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

  return (
    <section className="mx-auto w-[760px] max-w-full">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-medium tracking-tight">Members</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View everyone who belongs to your organization.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card text-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
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
              ) : sortedMembers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No members found.
                  </TableCell>
                </TableRow>
              ) : (
                sortedMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.email}
                    </TableCell>
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
      </div>
    </section>
  );
}
