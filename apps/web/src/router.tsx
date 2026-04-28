import { createBrowserRouter } from "react-router";

import { RequireAuth } from "./auth";
import { AppLayout } from "./routes/app-layout";
import { DashboardRoute } from "./routes/dashboard";
import { NotFoundRoute } from "./routes/not-found";
import { ScheduleRoute } from "./routes/schedule";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: (
          <RequireAuth>
            <DashboardRoute />
          </RequireAuth>
        ),
      },
      {
        path: "dashboard",
        element: (
          <RequireAuth>
            <DashboardRoute />
          </RequireAuth>
        ),
      },
      {
        path: "schedule",
        element: (
          <RequireAuth>
            <ScheduleRoute />
          </RequireAuth>
        ),
      },
      {
        path: "*",
        element: <NotFoundRoute />,
      },
    ],
  },
]);
