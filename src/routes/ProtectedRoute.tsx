import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth/AuthProvider';
import type { UserRole } from '@/types/database.types';
import { Loader2 } from 'lucide-react';

interface Props {
  children: ReactNode;
  requireRole?: UserRole | UserRole[];
}

export function ProtectedRoute({ children, requireRole }: Props) {
  const { loading, session, profile } = useAuth();
  const location = useLocation();

  const Loader = (
    <div className="flex h-screen items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      טוען…
    </div>
  );

  if (loading) return Loader;

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If a role is required but the profile hasn't loaded yet, wait — otherwise
  // we'd let a user through to a page they may not be allowed to see. The
  // load is normally instant (RLS allows reading own profile).
  if (requireRole) {
    if (!profile) return Loader;
    const allowed = Array.isArray(requireRole) ? requireRole : [requireRole];
    if (!allowed.includes(profile.role)) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
