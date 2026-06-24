import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/store/AuthProvider";
import AuthSplash from "@/features/auth/AuthSplash";

export default function AuthGuard() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <AuthSplash />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
