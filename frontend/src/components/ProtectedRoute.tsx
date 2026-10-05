import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { toast } from "sonner";

export const ProtectedRoute = ({ allowedRoles }: { allowedRoles: string[] }) => {
  const { user, accessToken } = useAuthStore();

  // Guards against a role the route doesn't allow.
  const isDisallowed = Boolean(user && accessToken && !allowedRoles.includes(user.role));

  // The toast belongs in an effect: firing it during render produces one
  // message per render pass, and double-fires under StrictMode + React 19.
  useEffect(() => {
    if (isDisallowed) {
      toast.error("You are not authorized to access this page.");
    }
  }, [isDisallowed]);

  if (!user || !accessToken) {
    return <Navigate to="/login" />;
  }
  if (isDisallowed) {
    // Land them on their own dashboard rather than the marketing page.
    return <Navigate to={`/${user.role}/dashboard`} replace />;
  }
  return <Outlet />;
};
