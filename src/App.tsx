import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from '@/lib/auth/AuthProvider';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { StuckGuard } from '@/routes/StuckGuard';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';

// Lazy-load everything behind auth so the login bundle stays small and the
// rest of the app streams in on demand.
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'));
const AdminOverview = lazy(() => import('@/pages/admin/AdminOverview'));
const AdminServices = lazy(() => import('@/pages/admin/AdminServices'));
const AdminSpecialties = lazy(() => import('@/pages/admin/AdminSpecialties'));
const AdminDoctors = lazy(() => import('@/pages/admin/AdminDoctors'));
const AdminAppointments = lazy(() => import('@/pages/admin/AdminAppointments'));
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'));
const DoctorLayout = lazy(() => import('@/pages/doctor/DoctorLayout'));
const DoctorCalendar = lazy(() => import('@/pages/doctor/DoctorCalendar'));
const DoctorHours = lazy(() => import('@/pages/doctor/DoctorHours'));
const DoctorProfile = lazy(() => import('@/pages/doctor/DoctorProfile'));
const BookLayout = lazy(() => import('@/pages/book/BookLayout'));
const MyAppointments = lazy(() => import('@/pages/book/MyAppointments'));
const NewAppointment = lazy(() => import('@/pages/book/NewAppointment'));
const BookingChat = lazy(() => import('@/pages/book/BookingChat'));

function CenterLoader() {
  return (
    <div className="flex h-screen items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      טוען…
    </div>
  );
}

function RootRedirect() {
  const { loading, session, profile } = useAuth();
  if (loading) return <StuckGuard />;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <StuckGuard />;
  if (profile.role === 'admin') return <Navigate to="/admin" replace />;
  if (profile.role === 'doctor') return <Navigate to="/doctor" replace />;
  return <Navigate to="/book" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<CenterLoader />}>
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
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
