import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth/AuthProvider';
import type { UserRole } from '@/types/database.types';
import { StuckGuard } from './StuckGuard';

interface Props {
  children: ReactNode;
  requireRole?: UserRole | UserRole[];
}

export function ProtectedRoute({ children, requireRole }: Props) {
  const { loading, session, profile } = useAuth();
  const location = useLocation();

  if (loading) return <StuckGuard />;

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If a role is required but the profile hasn't loaded yet, wait — otherwise
  // we'd let a user through to a page they may not be allowed to see. The
  // load is normally instant (RLS allows reading own profile), but if it
  // hangs we surface a recovery UI rather than spinning forever.
  if (requireRole) {
    if (!profile) return <StuckGuard />;
    const allowed = Array.isArray(requireRole) ? requireRole : [requireRole];
    if (!allowed.includes(profile.role)) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
