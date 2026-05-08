import { createBrowserRouter } from "react-router";

import { NavigateToOrganization, RequireAuth, RequireEmployee } from "./auth";
import { AppLayout } from "./routes/app-layout";
import { DashboardRoute } from "./routes/dashboard";
import { NotFoundRoute } from "./routes/not-found";
import { OnboardingRoute } from "./routes/onboarding";
import { ScheduleRoute } from "./routes/schedule";
import { SettingsRoute } from "./routes/settings";
import { SettingsMembersRoute } from "./routes/settings/members";

export const router = createBrowserRouter([
  {
    path: "/onboarding",
    element: (
      <RequireAuth>
        <OnboardingRoute />
      </RequireAuth>
    ),
  },
  {
    path: "/",
    element: (
      <RequireAuth>
        <RequireEmployee>
          <NavigateToOrganization />
        </RequireEmployee>
      </RequireAuth>
    ),
  },
  {
    path: "/:orgname",
    element: (
      <RequireAuth>
        <RequireEmployee>
          <AppLayout />
        </RequireEmployee>
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <DashboardRoute />,
      },
      {
        path: "schedule",
        element: <ScheduleRoute />,
      },
      {
        path: "settings",
        element: <SettingsRoute />,
        children: [
          {
            path: "members",
            element: <SettingsMembersRoute />,
          },
        ],
      },
      {
        path: "*",
        element: <NotFoundRoute />,
      },
    ],
  },
]);
