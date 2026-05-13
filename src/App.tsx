import { ComponentType, lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from '@/lib/auth/AuthProvider';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { StuckGuard } from '@/routes/StuckGuard';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';

// Wraps lazy() so that a chunk-load failure (typically: the user has an old
// index.html cached after we shipped a new deploy, and the old chunk hashes
// no longer exist on the CDN — Vercel returns 404 → blank screen) triggers
// a one-shot hard reload to fetch the fresh index.html + new chunks.
// sessionStorage flag prevents infinite reload loops if the real issue is
// something else (e.g. the chunk genuinely doesn't exist on the server).
function lazyWithReload<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (e) {
      const KEY = 'mediq.chunk-reload';
      if (typeof window !== 'undefined' && !sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, '1');
        window.location.reload();
        // Return a never-resolving promise so React doesn't render anything
        // while the page is reloading.
        return new Promise<{ default: T }>(() => {});
      }
      throw e;
    }
  });
}

// Lazy-load everything behind auth so the login bundle stays small and the
// rest of the app streams in on demand.
const AdminLayout = lazyWithReload(() => import('@/pages/admin/AdminLayout'));
const AdminOverview = lazyWithReload(() => import('@/pages/admin/AdminOverview'));
const AdminServices = lazyWithReload(() => import('@/pages/admin/AdminServices'));
const AdminSpecialties = lazyWithReload(() => import('@/pages/admin/AdminSpecialties'));
const AdminDoctors = lazyWithReload(() => import('@/pages/admin/AdminDoctors'));
const AdminAppointments = lazyWithReload(() => import('@/pages/admin/AdminAppointments'));
const AdminSettings = lazyWithReload(() => import('@/pages/admin/AdminSettings'));
const DoctorLayout = lazyWithReload(() => import('@/pages/doctor/DoctorLayout'));
const DoctorCalendar = lazyWithReload(() => import('@/pages/doctor/DoctorCalendar'));
const DoctorHours = lazyWithReload(() => import('@/pages/doctor/DoctorHours'));
const DoctorProfile = lazyWithReload(() => import('@/pages/doctor/DoctorProfile'));
const BookLayout = lazyWithReload(() => import('@/pages/book/BookLayout'));
const MyAppointments = lazyWithReload(() => import('@/pages/book/MyAppointments'));
const NewAppointment = lazyWithReload(() => import('@/pages/book/NewAppointment'));
const BookingChat = lazyWithReload(() => import('@/pages/book/BookingChat'));

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
