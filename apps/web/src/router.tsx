import { createBrowserRouter } from "react-router";

import { NavigateToOrganization, RequireAuth, RequireEmployee } from "./auth";
import { AppLayout } from "./routes/app-layout";
import { DashboardRoute } from "./routes/dashboard";
import { NotFoundRoute } from "./routes/not-found";
import { OnboardingRoute } from "./routes/onboarding";
import { ScheduleRoute } from "./routes/schedule";
import { SettingsRoute } from "./routes/settings";
import { SettingsAvailabilityRoute } from "./routes/settings/availability";
import { SettingsBillingRoute } from "./routes/settings/billing";
import { SettingsCompanyProfileRoute } from "./routes/settings/company-profile";
import { SettingsDepartmentsRoute } from "./routes/settings/departments";
import { SettingsImportRoute } from "./routes/settings/import";
import { SettingsLocationGroupsRoute } from "./routes/settings/location-groups";
import { SettingsLocationDetailRoute } from "./routes/settings/location-detail";
import { SettingsLocationsRoute } from "./routes/settings/locations";
import { SettingsLayout } from "./routes/settings/settings-layout";
import { SettingsMembersRoute } from "./routes/settings/members";
import { SettingsProfileRoute } from "./routes/settings/profile";

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
        path: "*",
        element: <NotFoundRoute />,
      },
    ],
  },
  {
    path: "/:orgname/settings",
    element: (
      <RequireAuth>
        <RequireEmployee>
          <SettingsLayout />
        </RequireEmployee>
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <SettingsRoute />,
      },
      {
        path: "profile",
        element: <SettingsProfileRoute />,
      },
      {
        path: "availability",
        element: <SettingsAvailabilityRoute />,
      },
      {
        path: "company-profile",
        element: <SettingsCompanyProfileRoute />,
      },
      {
        path: "members",
        element: <SettingsMembersRoute />,
      },
      {
        path: "locations",
        element: <SettingsLocationsRoute />,
      },
      {
        path: "locations/:locationname",
        element: <SettingsLocationDetailRoute />,
      },
      {
        path: "departments",
        element: <SettingsDepartmentsRoute />,
      },
      {
        path: "location-groups",
        element: <SettingsLocationGroupsRoute />,
      },
      {
        path: "billing",
        element: <SettingsBillingRoute />,
      },
      {
        path: "import",
        element: <SettingsImportRoute />,
      },
    ],
  },
]);
