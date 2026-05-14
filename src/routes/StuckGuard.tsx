import { useEffect, useState } from 'react';
import { Loader2, RotateCcw, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/BrandMark';
import { useAuth } from '@/lib/auth/AuthProvider';

// Shows a rich loading card while auth/profile loads, then a cold-start hint
// after a short delay, then a recovery UI (reload/logout) once we know the
// load actually failed or has dragged on too long. The progressive disclosure
// keeps the screen visually present instead of looking like a frozen blank
// page — which is what users perceived when the loader was just a 16px
// spinner on a near-white background.
export function StuckGuard({
  hintAfterMs = 4000,
  giveUpAfterMs = 95000,
}: {
  hintAfterMs?: number;
  giveUpAfterMs?: number;
}) {
  // 95s give-up is intentional: loadProfile auto-retries up to 3× 30s for
  // cold-start tolerance (~90s max), so we mustn't show recovery UI before
  // those auto-retries finish — otherwise the user clicks Reload mid-retry
  // and we're back to square one. Recovery still appears instantly on
  // profileError, which fires only after the auto-retry chain exhausts.
  const [showHint, setShowHint] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const { signOut, profileError } = useAuth();

  useEffect(() => {
    const t1 = window.setTimeout(() => setShowHint(true), hintAfterMs);
    const t2 = window.setTimeout(() => setGaveUp(true), giveUpAfterMs);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [hintAfterMs, giveUpAfterMs]);

  // Surface recovery UI either when we already know it failed, or after the
  // give-up window has elapsed.
  const failed = gaveUp || !!profileError;

  return (
    <div className="flex h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-teal-400 text-white shadow-md shadow-primary/30">
          <BrandMark className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-bold">MediQ</h2>

        {!failed ? (
          <>
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              טוען את החשבון…
            </div>
            {showHint && (
              <p className="mt-3 text-xs text-muted-foreground/80">
                כניסה ראשונה לאחר חוסר פעילות עלולה לקחת עד דקה.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="mt-4 text-sm font-medium text-foreground">
              לא הצלחנו לטעון את הפרופיל
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              ייתכן שיש בעיית רשת זמנית. נסה לטעון מחדש או להתנתק ולהיכנס שוב.
            </p>
            {profileError && (
              <p
                dir="ltr"
                className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-left font-mono text-[11px] text-destructive"
              >
                {profileError}
              </p>
            )}
            <div className="mt-5 flex justify-center gap-2">
              <Button onClick={() => window.location.reload()} variant="default">
                <RotateCcw className="h-4 w-4" />
                טען מחדש
              </Button>
              <Button onClick={() => signOut()} variant="outline">
                <LogOut className="h-4 w-4" />
                התנתק
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
