import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from '@/lib/auth/AuthProvider';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import AdminLayout from '@/pages/admin/AdminLayout';
import AdminOverview from '@/pages/admin/AdminOverview';
import AdminServices from '@/pages/admin/AdminServices';
import AdminPlaceholder from '@/pages/admin/AdminPlaceholder';
import DoctorDashboard from '@/pages/DoctorDashboard';
import ClientDashboard from '@/pages/ClientDashboard';

function RootRedirect() {
  const { loading, session, profile } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        טוען…
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  if (profile?.role === 'admin') return <Navigate to="/admin" replace />;
  if (profile?.role === 'doctor') return <Navigate to="/doctor" replace />;
  return <Navigate to="/book" replace />;
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
            <Route path="services" element={<AdminServices />} />
            <Route
              path="doctors"
              element={
                <AdminPlaceholder
                  title="רופאים"
                  description="ניהול רופאים, התמחויות וזמינות"
                />
              }
            />
            <Route
              path="appointments"
              element={
                <AdminPlaceholder
                  title="תורים"
                  description="כל התורים במרפאה — תצוגה, סינון ועריכה"
                />
              }
            />
            <Route
              path="settings"
              element={
                <AdminPlaceholder
                  title="הגדרות"
                  description="הגדרות מרפאה, סיסמה ופרופיל"
                />
              }
            />
          </Route>

          <Route
            path="/doctor/*"
            element={
              <ProtectedRoute requireRole="doctor">
                <DoctorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/book/*"
            element={
              <ProtectedRoute requireRole={['client', 'admin']}>
                <ClientDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
