import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import RootLayout from './layouts/RootLayout';
import DashboardLayout from './layouts/DashboardLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuthStore } from './store/authStore'; // Imported to check session state
import './App.css';
import Login from './pages/Login';

// Patient Viewports
import PatientDashboard from '@/pages/PatientDashboard';

// Doctor Viewports
import DoctorDashboard from '@/pages/DoctorDashboard';
// 🚀 INLINE PUBLIC GATE DISPATCHER
// Prevents authenticated users from seeing public entry forms
const PublicGate = () => {
  const { user, accessToken } = useAuthStore();
  if (accessToken && user) {
    return <Navigate to={`/${user.role}/dashboard`} replace />;
  }
  return <Outlet />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        
        {/* ================= PUBLIC PATH PATHWAYS (RootLayout) ================= */}
        <Route element={<RootLayout />}>
          {/* Nested under PublicGate inline wrapper */}
          <Route element={<PublicGate />}>
            <Route path="/login" element={<Login />} />
          </Route>
          <Route path="/"/>
        </Route>

        {/* ================= SECURE DESKTOP APPLICATION SHELL (DashboardLayout) ================= */}
        <Route element={<DashboardLayout />}>
          
          {/* 🔐 PATIENT WORKSPACE ROUTE TREE */}
          <Route element={<ProtectedRoute allowedRoles={["patient"]} />}>
            <Route path="/patient/dashboard" element={<PatientDashboard />} />
          </Route>
        
          {/* 🔐 DOCTOR WORKSPACE ROUTE TREE */}
          <Route element={<ProtectedRoute allowedRoles={["doctor"]} />}>
            <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
          </Route>
        </Route>
        {/* Catch-all Absolute Fallback for unexpected URLs */}
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;