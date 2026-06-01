import {
  IconArrowLeft,
  IconBuilding,
  IconCalendar,
  IconCreditCard,
  IconMapPin,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import { NavLink, Outlet, useLocation, useParams } from "react-router";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { useEmployee } from "@/hooks/use-employee";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

export function SettingsLayout() {
  const { orgname } = useParams();
  const location = useLocation();
  const { employee } = useEmployee();
  const currentPath = location.pathname.replace(/\/$/, "");
  const base = `/${orgname ?? ""}/settings`;
  const organizationPath = `/${orgname ?? ""}`;
  const role = employee?.role;
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const canManageOrgRoster = isAdmin || isManager;

  const personalItems: NavItem[] = [
    { to: `${base}/profile`, label: "Profile", icon: IconUser },
    { to: `${base}/availability`, label: "Availability", icon: IconCalendar },
  ];

  const administrationItems: NavItem[] = [];
  if (isAdmin) {
    administrationItems.push({
      to: `${base}/company-profile`,
      label: "Company profile",
      icon: IconBuilding,
    });
  }
  if (canManageOrgRoster) {
    administrationItems.push(
      { to: `${base}/members`, label: "Members", icon: IconUsers },
      { to: `${base}/locations`, label: "Locations", icon: IconMapPin },
    );
  }
  if (isAdmin) {
    administrationItems.push(
      { to: `${base}/billing`, label: "Billing", icon: IconCreditCard },
    );
  }


  const groups: NavGroup[] = [{ items: personalItems }];
  if (administrationItems.length > 0) {
    groups.push({ label: "Administration", items: administrationItems });
  }

  return (
    <SidebarProvider className="h-svh min-h-0 overflow-hidden">
      <Sidebar
        collapsible="none"
        className="h-svh shrink-0 overflow-hidden border-r border-sidebar-border"
      >
        <SidebarHeader className="px-3 py-2">
          <NavLink
            to={organizationPath}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-fit"
          >
            <IconArrowLeft className="size-3.5" />
            Back to app
          </NavLink>
        </SidebarHeader>

        <SidebarContent className="overflow-hidden">
          {groups.map((group, i) => (
            <SidebarGroup key={i}>
              {group.label && (
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={currentPath === item.to.replace(/\/$/, "")}
                      >
                        <NavLink to={item.to}>
                          <item.icon className="size-4" />
                          {item.label}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
      </Sidebar>

      <SidebarInset className="h-svh min-h-0 overflow-y-auto py-10 px-4">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
