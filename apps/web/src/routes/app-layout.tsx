import { Outlet } from "react-router";

import { Sidebar } from "@/components/sidebar";

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-y-auto px-8 py-10">
        <Outlet />
      </main>
    </div>
  );
}
