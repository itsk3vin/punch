import { useAuth0 } from "@auth0/auth0-react";
import {
  IconCalendar,
  IconChevronUp,
  IconLayoutDashboard,
  IconLogout,
  IconSettings,
  IconUsers,
} from "@tabler/icons-react";
import { NavLink, useLocation } from "react-router";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useEmployee } from "@/hooks/use-employee";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: IconLayoutDashboard },
  { to: "/schedule", label: "Schedule", icon: IconCalendar },
];

function getInitials(name?: string, email?: string) {
  const source = name || email || "User";
  const parts = source
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getOrganizationInitials(name?: string) {
  return getInitials(name, "Organization");
}

export function Sidebar() {
  const { isAuthenticated, loginWithRedirect, logout, user } = useAuth0();
  const { organization } = useEmployee();
  const location = useLocation();
  const initials = getInitials(user?.name, user?.email);
  const organizationName = organization?.name ?? "Punch";
  const organizationInitials = getOrganizationInitials(organization?.name);

  return (
    <ShadcnSidebar collapsible="icon">
      <SidebarHeader className="px-3 py-2">
        <div className="flex items-center gap-3">
          <Avatar className="size-6 rounded-full">
            <AvatarImage
              src={organization?.logoUrl ?? undefined}
              alt={`${organizationName} logo`}
              className="rounded-full w-6 h-6 object-cover"
            />
            <AvatarFallback className="rounded-lg text-xs">
              {organizationInitials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-medium tracking-tight">
              {organizationName}
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.to}
                    tooltip={item.label}
                  >
                    <NavLink to={item.to}>
                      <item.icon aria-hidden="true" />
                      <span>{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter>
        {isAuthenticated ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" className="h-auto gap-3 py-2">
                    {user?.picture ? (
                      <img
                        src={user.picture}
                        alt=""
                        className="size-6 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                        {initials}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                      <span className="flex flex-col gap-0.5">
                        <span className="truncate text-xs font-normal">
                          {user?.name ?? "Profile"}
                        </span>
                      </span>
                    </span>
                    <IconChevronUp className="ml-auto group-data-[collapsible=icon]:hidden" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  side="right"
                  className="w-56"
                >
                  <DropdownMenuItem>
                    <IconSettings aria-hidden="true" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <IconUsers aria-hidden="true" />
                    Team
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() =>
                      logout({
                        logoutParams: { returnTo: window.location.origin },
                      })
                    }
                  >
                    <IconLogout aria-hidden="true" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
            onClick={() => void loginWithRedirect()}
          >
            <span className="group-data-[collapsible=icon]:sr-only">
              Sign in
            </span>
          </Button>
        )}
      </SidebarFooter>
    </ShadcnSidebar>
  );
}
