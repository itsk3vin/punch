import { useParams } from "react-router";
import { Navigate } from "react-router";

export function SettingsRoute() {
  const { orgname } = useParams();
  return <Navigate to={`/${orgname ?? ""}/settings/profile`} replace />;
}
