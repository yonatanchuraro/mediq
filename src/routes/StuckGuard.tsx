import { useEffect, useState } from 'react';
import { Loader2, RotateCcw, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/AuthProvider';

// Renders a loader, but if we're still here after `timeoutMs` ms, shows a
// recovery UI instead — letting the user escape the stuck state without
// having to manually clear cookies / hard-reload.
export function StuckGuard({ timeoutMs = 5000 }: { timeoutMs?: number }) {
  const [stuck, setStuck] = useState(false);
  const { signOut } = useAuth();

  useEffect(() => {
    const t = window.setTimeout(() => setStuck(true), timeoutMs);
    return () => window.clearTimeout(t);
  }, [timeoutMs]);

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
