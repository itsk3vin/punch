import { Outlet } from "react-router";

import { Sidebar } from "@/components/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function AppLayout() {
  return (
    <SidebarProvider>
      <Sidebar />
      <SidebarInset className="overflow-y-auto px-8 py-10">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
