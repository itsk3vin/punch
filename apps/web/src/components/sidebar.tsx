import { useAuth0 } from "@auth0/auth0-react";
import {
  IconCalendar,
  IconChevronDown,
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="flex w-fit items-center gap-3 rounded-md p-1 text-left hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <div className="flex items-center gap-2">
              <Avatar className="size-5 rounded-sm">
                <AvatarImage
                  src={organization?.logoUrl ?? undefined}
                  alt={`${organizationName} logo`}
                  className="rounded-sm w-5 h-5 object-cover"
                />
                <AvatarFallback className="rounded-lg text-xs">
                  {organizationInitials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-sm font-medium tracking-tight">
                  {organizationName}
                </p>
              </div>
              </div>
              <IconChevronDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="bottom" className="w-56">
            <DropdownMenuItem>
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem>
              Invite and manage members
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

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

      
    </ShadcnSidebar>
  );
}
