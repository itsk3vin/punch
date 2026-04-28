import { createBrowserRouter } from "react-router";

import { RequireAuth } from "./auth";
import { AppLayout } from "./routes/app-layout";
import { LoginRoute } from "./routes/auth/login";
import { DashboardRoute } from "./routes/dashboard";
import { NotFoundRoute } from "./routes/not-found";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        path: "/",
        element: (
          <RequireAuth>
            <DashboardRoute />
          </RequireAuth>
        ),
      },
      {
        path: "auth/login",
        element: <LoginRoute />,
      },
      {
        path: "*",
        element: <NotFoundRoute />,
      },
    ],
  },
]);
