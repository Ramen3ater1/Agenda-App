import { Navigate } from "react-router";
import { useAuth } from "@/store/AuthProvider";
import { AuthForm } from "@/features/auth";

export default function SignupRoute() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/today" replace />;
  return <AuthForm mode="signup" />;
}
