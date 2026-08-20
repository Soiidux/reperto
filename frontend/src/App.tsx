import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import RootLayout from './layouts/RootLayout';
import DashboardLayout from './layouts/DashboardLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuthStore } from './store/authStore'; // Imported to check session state
import './App.css';
import Login from './pages/Login';
import Register from './pages/Register';
import FindDoctors from './pages/FindDoctors';
import BookAppointment from './pages/BookAppointment';
import Appointments from './pages/Appointments';
import AllAppointments from './pages/AllAppointments';
import TakeConsultation from './pages/TakeConsultation';
import ViewAppointment from './pages/ViewAppointment';
import ViewConsultation from './pages/ViewConsultation';
import ConsultationHistory from './pages/ConsultationHistory';
import ActivePatients from './pages/ActivePatients';
import Profile from './pages/Profile';
import PatientDirectory from './pages/PatientDirectory';
import PastAppointments from './pages/PastAppointments';
import Schedule from './pages/Schedule';

// Patient Viewports
import PatientDashboard from '@/pages/PatientDashboard';

// Doctor Viewports
import DoctorDashboard from '@/pages/DoctorDashboard';

// Admin / Staff Viewports
import AdminDashboard from '@/pages/AdminDashboard';
import StaffDashboard from '@/pages/StaffDashboard';

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
            <Route path="/register" element={<Register />} />
          </Route>
          <Route path="/doctors" element={<FindDoctors/>}/>
        </Route>

        {/* ================= SECURE DESKTOP APPLICATION SHELL (DashboardLayout) ================= */}
        <Route element={<DashboardLayout />}>
          
          {/* 🔐 PATIENT WORKSPACE ROUTE TREE */}
          <Route element={<ProtectedRoute allowedRoles={["patient"]} />}>
            <Route path="/patient/dashboard" element={<PatientDashboard />} />
            <Route path="/patient/doctors" element={<FindDoctors />} />
            <Route path="/patient/book-appointment" element={<BookAppointment />} />
            <Route path="/patient/appointments" element={<Appointments />} />
            <Route path="/patient/appointments/all" element={<AllAppointments />} />
            <Route path="/patient/appointments/:id" element={<ViewAppointment />} />
            <Route path="/patient/consultation/:id" element={<ViewConsultation />} />
            <Route path="/patient/consultation/history/" element={<ConsultationHistory />} />
            <Route path="/patient/profile" element={<Profile />} />
          </Route>
        
          {/* 🔐 DOCTOR WORKSPACE ROUTE TREE */}
          <Route element={<ProtectedRoute allowedRoles={["doctor"]} />}>
            <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
            <Route path="/doctor/active-patients" element={<ActivePatients />} />
            <Route path="/doctor/patients" element={<PatientDirectory />} />
            <Route path="/doctor/appointments" element={<Appointments />} />
            <Route path="/doctor/appointments/all" element={<AllAppointments />} />
            <Route path="/doctor/appointments/:id" element={<ViewAppointment />} />
            <Route path="/doctor/past-appointments" element={<PastAppointments />} />
            <Route path="/doctor/schedule" element={<Schedule />} />
            <Route path="/doctor/start-consultation/:id" element={<TakeConsultation />} />
            <Route path="/doctor/consultation/:id" element={<ViewConsultation />} />
            <Route path="/doctor/consultation/history/:patientId" element={<ConsultationHistory />} />
            <Route path="/doctor/profile" element={<Profile />} />
          </Route>

          {/* 🔐 ADMIN WORKSPACE ROUTE TREE */}
          <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
          </Route>

          {/* 🔐 STAFF WORKSPACE ROUTE TREE */}
          <Route element={<ProtectedRoute allowedRoles={["staff"]} />}>
            <Route path="/staff/dashboard" element={<StaffDashboard />} />
            <Route path="/staff/appointments" element={<Appointments />} />
            <Route path="/staff/appointments/all" element={<AllAppointments />} />
            <Route path="/staff/appointments/:id" element={<ViewAppointment />} />
          </Route>
        </Route>

        {/* Root redirects to the doctors directory for guests */}
        <Route path="/" element={<Navigate to="/doctors" replace />} />
        {/* Catch-all Absolute Fallback for unexpected URLs */}
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;