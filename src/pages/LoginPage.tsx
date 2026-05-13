import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Loader2, Lock, MessageSquare, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BrandMark } from '@/components/BrandMark';

export default function LoginPage() {
  const { session, signIn, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!authLoading && session) {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';
    return <Navigate to={from} replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      toast.success('ברוך שובך');
      // Honor the "from" location captured by ProtectedRoute when the user
      // was bounced to /login — otherwise we'd dump them at "/" regardless
      // of which page they were originally trying to reach.
      const from =
        (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'התחברות נכשלה');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <AuthFormCard
        title="ברוכים הבאים"
        subtitle="כניסה לחשבון MediQ שלך"
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-300">אימייל</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="h-11 border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-primary/50"
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-slate-300">סיסמה</Label>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="h-11 border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-primary/50"
              placeholder="••••••••"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="shimmer-button h-11 w-full bg-gradient-to-r from-teal-500 via-primary to-teal-400 text-white shadow-lg shadow-primary/30 transition hover:from-teal-600 hover:to-teal-500 hover:shadow-xl hover:shadow-primary/40"
          >
            {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            {loading ? 'מתחבר…' : 'כניסה'}
            {!loading && <ArrowLeft className="h-4 w-4" />}
          </Button>
          <p className="text-center text-sm text-slate-400">
            עדיין אין לך חשבון?{' '}
            <Link
              to="/signup"
              className="font-medium text-primary transition hover:text-teal-300"
            >
              הרשמה
            </Link>
          </p>
        </form>
      </AuthFormCard>
    </AuthShell>
  );
}

// ── Reusable auth shell + form card ──────────────────────────────────────

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-screen w-full overflow-hidden bg-[#070b16] text-white lg:grid-cols-[1.1fr_1fr]">
      {/* Animated mesh background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="auth-blob-1 absolute -top-40 -right-40 h-[42rem] w-[42rem] rounded-full opacity-60 blur-3xl"
          style={{ background: 'radial-gradient(circle at center, rgba(13,148,136,0.55), transparent 65%)' }}
        />
        <div
          className="auth-blob-2 absolute top-1/3 -left-32 h-[36rem] w-[36rem] rounded-full opacity-50 blur-3xl"
          style={{ background: 'radial-gradient(circle at center, rgba(99,102,241,0.5), transparent 65%)' }}
        />
        <div
          className="auth-blob-3 absolute -bottom-40 right-1/4 h-[34rem] w-[34rem] rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle at center, rgba(45,212,191,0.4), transparent 65%)' }}
        />
        <div className="auth-grid absolute inset-0 opacity-50" />
      </div>

      {/* Left side — hero / brand panel (only visible on large screens) */}
      <aside className="relative z-10 hidden flex-col justify-between p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-teal-400 text-white shadow-lg shadow-primary/30">
            <BrandMark className="h-5 w-5" />
          </div>
          <span className="text-xl font-extrabold tracking-tight">MediQ</span>
        </div>

        <div className="max-w-md space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              חי וזמין 24/7
            </div>
            <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight">
              ניהול תורי מרפאה{' '}
              <span className="gradient-text">מודרני וחכם</span>
            </h1>
            <p className="text-lg text-slate-400">
              קביעת תורים בקליק, צ׳אט AI חכם, יומן בזמן אמת וניהול מטופלים מקצה לקצה.
            </p>
          </div>

          <div className="grid gap-3">
            <Feature
              icon={<MessageSquare className="h-4 w-4" />}
              title="עוזר AI להזמנת תורים"
              desc="המטופל מדבר טבעי, ה-AI מבין ומקבע אוטומטית"
            />
            <Feature
              icon={<Calendar className="h-4 w-4" />}
              title="יומן חי"
              desc="כל רופא רואה את התורים שלו, מאשר ומנהל בקלות"
            />
            <Feature
              icon={<Lock className="h-4 w-4" />}
              title="אבטחה ברמה גבוהה"
              desc="Row-Level Security, JWT, ו-RBAC לכל פעולה"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Sparkles className="h-3 w-3" />
          Powered by Supabase + Gemini
        </div>
      </aside>

      {/* Right side — form */}
      <main className="relative z-10 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          {/* Mobile-only brand */}
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-teal-400 text-white shadow-lg shadow-primary/30">
              <BrandMark className="h-5 w-5" />
            </div>
            <span className="text-xl font-extrabold tracking-tight">MediQ</span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-sm">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/30 to-teal-400/20 text-primary">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-slate-400">{desc}</div>
      </div>
    </div>
  );
}

export function AuthFormCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur-xl shadow-2xl shadow-black/20">
      <div className="mb-6 space-y-1">
        <h2 className="text-3xl font-extrabold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
