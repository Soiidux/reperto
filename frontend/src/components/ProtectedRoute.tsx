import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
export const ProtectedRoute = ({ allowedRoles }: {allowedRoles: string[]}) => {
  const { user, accessToken } = useAuthStore();
  if (!user || !accessToken) {
    return <Navigate to="/login" />;
  }
  if (!allowedRoles.includes(user?.role)) {
    toast.error("You are not authorized to access this page.");
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
};
