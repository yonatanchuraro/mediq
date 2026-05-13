import { useEffect, useState } from 'react';
import { Loader2, RotateCcw, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/AuthProvider';

// Renders a loader, but if we're still here after `timeoutMs` ms (or if
// AuthProvider has already reported a profile-load error), shows a recovery
// UI instead — letting the user escape the stuck state without having to
// manually clear cookies / hard-reload.
export function StuckGuard({ timeoutMs = 5000 }: { timeoutMs?: number }) {
  const [timedOut, setTimedOut] = useState(false);
  const { signOut, profileError } = useAuth();

  useEffect(() => {
    const t = window.setTimeout(() => setTimedOut(true), timeoutMs);
    return () => window.clearTimeout(t);
  }, [timeoutMs]);

  // Surface the error immediately if we already know the load failed,
  // instead of pretending to load for 5 more seconds.
  const stuck = timedOut || !!profileError;

  if (!stuck) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        טוען…
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="max-w-md space-y-2">
        <h2 className="text-xl font-bold">לא הצלחנו לטעון את הפרופיל</h2>
        <p className="text-sm text-muted-foreground">
          ייתכן שיש בעיית רשת זמנית. אפשר לנסות לטעון מחדש, או להתנתק ולהיכנס שוב.
        </p>
        {profileError && (
          <p
            dir="ltr"
            className="rounded-md bg-destructive/10 px-3 py-2 text-left font-mono text-xs text-destructive"
          >
            {profileError}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={() => window.location.reload()} variant="default">
          <RotateCcw className="h-4 w-4" />
          טען מחדש
        </Button>
        <Button onClick={() => signOut()} variant="outline">
          <LogOut className="h-4 w-4" />
          התנתק
        </Button>
      </div>
    </div>
  );
}
