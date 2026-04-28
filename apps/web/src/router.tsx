import { createBrowserRouter } from "react-router";

import { AppLayout } from "./routes/app-layout";
import { LoginRoute } from "./routes/auth/login";
import { DashboardRoute } from "./routes/dashboard";
import { HomeRoute } from "./routes/home";
import { NotFoundRoute } from "./routes/not-found";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <HomeRoute />,
      },
      {
        path: "dashboard",
        element: <DashboardRoute />,
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
