import { createBrowserRouter } from "react-router";

import { RequireAuth, RequireEmployee } from "./auth";
import { AppLayout } from "./routes/app-layout";
import { DashboardRoute } from "./routes/dashboard";
import { NotFoundRoute } from "./routes/not-found";
import { OnboardingRoute } from "./routes/onboarding";
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
            <RequireEmployee>
              <DashboardRoute />
            </RequireEmployee>
          </RequireAuth>
        ),
      },
      {
        path: "dashboard",
        element: (
          <RequireAuth>
            <RequireEmployee>
              <DashboardRoute />
            </RequireEmployee>
          </RequireAuth>
        ),
      },
      {
        path: "onboarding",
        element: (
          <RequireAuth>
            <OnboardingRoute />
          </RequireAuth>
        ),
      },
      {
        path: "schedule",
        element: (
          <RequireAuth>
            <RequireEmployee>
              <ScheduleRoute />
            </RequireEmployee>
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
