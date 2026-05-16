import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export const ProtectedRoute = ({ allowedRoles }: {allowedRoles: string[]}) => {
  const { user, accessToken } = useAuthStore();
  if (!user || !accessToken) {
    return <Navigate to="/login" />;
  }
  if (!allowedRoles.includes(user?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  return <Outlet />;
};
