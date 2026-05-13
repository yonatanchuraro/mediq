import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell, AuthFormCard } from '@/pages/LoginPage';

export default function SignupPage() {
  const { session, signUp, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);

  if (!authLoading && session) return <Navigate to="/" replace />;

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 6) {
      toast.error('הסיסמה חייבת להיות לפחות 6 תווים');
      return;
    }
    setLoading(true);
    try {
      const { needsConfirmation } = await signUp({
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        phone: form.phone || undefined,
      });
      if (needsConfirmation) {
        toast.success('נשלח אליך אימייל לאישור — אשר אותו לפני הכניסה.');
        navigate('/login', { replace: true });
        return;
      }
      toast.success('החשבון נוצר, ברוך הבא!');
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'הרשמה נכשלה');
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'h-11 border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-primary/50';
  const labelClass = 'text-slate-300';

  return (
    <AuthShell>
      <AuthFormCard
        title="פתיחת חשבון"
        subtitle="צור חשבון מטופל ב-MediQ — 30 שניות"
      >
        <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
          <div className="space-y-2">
            <Label htmlFor="full_name" className={labelClass}>שם מלא</Label>
            <Input
              id="full_name"
              value={form.full_name}
              onChange={(e) => update('full_name', e.target.value)}
              autoComplete="name"
              required
              className={inputClass}
              placeholder="ישראל ישראלי"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" className={labelClass}>טלפון (אופציונלי)</Label>
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              autoComplete="tel"
              className={inputClass}
              placeholder="050-1234567"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className={labelClass}>אימייל</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              autoComplete="email"
              required
              className={inputClass}
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className={labelClass}>סיסמה</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
              className={inputClass}
              placeholder="לפחות 6 תווים"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="shimmer-button h-11 w-full bg-gradient-to-r from-teal-500 via-primary to-teal-400 text-white shadow-lg shadow-primary/30 transition hover:from-teal-600 hover:to-teal-500 hover:shadow-xl hover:shadow-primary/40"
          >
            {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            {loading ? 'יוצר חשבון…' : 'הרשמה'}
            {!loading && <ArrowLeft className="h-4 w-4" />}
          </Button>
          <p className="text-center text-sm text-slate-400">
            כבר רשום?{' '}
            <Link
              to="/login"
              className="font-medium text-primary transition hover:text-teal-300"
            >
              כניסה
            </Link>
          </p>
        </form>
      </AuthFormCard>
    </AuthShell>
  );
}
