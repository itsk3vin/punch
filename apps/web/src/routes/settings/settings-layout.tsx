import {
  IconArrowLeft,
  IconBuilding,
  IconCalendar,
  IconCreditCard,
  IconFileImport,
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
  const currentPath = location.pathname.replace(/\/$/, "");
  const base = `/${orgname ?? ""}/settings`;
  const organizationPath = `/${orgname ?? ""}`;

  const groups: NavGroup[] = [
    {
      items: [
        { to: `${base}/profile`, label: "Profile", icon: IconUser },
        { to: `${base}/availability`, label: "Availability", icon: IconCalendar },
      ],
    },
    {
      label: "Administration",
      items: [
        { to: `${base}/company-profile`, label: "Company profile", icon: IconBuilding },
        { to: `${base}/members`, label: "Members", icon: IconUsers },
        { to: `${base}/billing`, label: "Billing", icon: IconCreditCard },
        { to: `${base}/import`, label: "Import", icon: IconFileImport },
      ],
    },
  ];

  return (
    <SidebarProvider>
      <Sidebar collapsible="none" className="h-screen border-r border-sidebar-border">
        <SidebarHeader className="px-3 py-2">
          <NavLink
            to={organizationPath}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-fit"
          >
            <IconArrowLeft className="size-3.5" />
            Back to app
          </NavLink>
        </SidebarHeader>

        <SidebarContent>
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

      <SidebarInset className="overflow-y-auto px-10 py-10">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
