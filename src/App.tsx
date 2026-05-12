import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from '@/lib/auth/AuthProvider';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import AdminLayout from '@/pages/admin/AdminLayout';
import AdminOverview from '@/pages/admin/AdminOverview';
import AdminServices from '@/pages/admin/AdminServices';
import AdminSpecialties from '@/pages/admin/AdminSpecialties';
import AdminDoctors from '@/pages/admin/AdminDoctors';
import AdminAppointments from '@/pages/admin/AdminAppointments';
import AdminSettings from '@/pages/admin/AdminSettings';
import DoctorLayout from '@/pages/doctor/DoctorLayout';
import DoctorCalendar from '@/pages/doctor/DoctorCalendar';
import DoctorHours from '@/pages/doctor/DoctorHours';
import DoctorProfile from '@/pages/doctor/DoctorProfile';
import BookLayout from '@/pages/book/BookLayout';
import MyAppointments from '@/pages/book/MyAppointments';
import NewAppointment from '@/pages/book/NewAppointment';
import BookingChat from '@/pages/book/BookingChat';

function RootRedirect() {
  const { loading, session, profile } = useAuth();

  // Wait for both the auth context bootstrap AND for the profile lookup to
  // finish, otherwise we race: signIn() returns → onAuthStateChange has set
  // session but loadProfile is still in flight → profile is null → we'd
  // fall through to /book for an admin. The loader bridges those few ms.
  if (loading) {
    return <CenterLoader />;
  }
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <CenterLoader />;
  if (profile.role === 'admin') return <Navigate to="/admin" replace />;
  if (profile.role === 'doctor') return <Navigate to="/doctor" replace />;
  return <Navigate to="/book" replace />;
}

function CenterLoader() {
  return (
    <div className="flex h-screen items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      טוען…
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          <Route
            path="/admin"
            element={
              <ProtectedRoute requireRole="admin">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminOverview />} />
            <Route path="specialties" element={<AdminSpecialties />} />
            <Route path="services" element={<AdminServices />} />
            <Route path="doctors" element={<AdminDoctors />} />
            <Route path="appointments" element={<AdminAppointments />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          <Route
            path="/doctor"
            element={
              <ProtectedRoute requireRole="doctor">
                <DoctorLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DoctorCalendar />} />
            <Route path="hours" element={<DoctorHours />} />
            <Route path="profile" element={<DoctorProfile />} />
          </Route>
          <Route
            path="/book"
            element={
              <ProtectedRoute requireRole={['client', 'admin']}>
                <BookLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<MyAppointments />} />
            <Route path="new" element={<NewAppointment />} />
            <Route path="chat" element={<BookingChat />} />
          </Route>

          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
