import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { BrandMark } from '@/components/BrandMark';

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
      await signUp({
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        phone: form.phone || undefined,
      });
      toast.success('החשבון נוצר, ברוך הבא!');
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'הרשמה נכשלה');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b1020] px-4 py-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[-20%] blur-3xl"
        style={{
          background:
            'radial-gradient(40% 40% at 25% 30%, rgba(13,148,136,0.45), transparent 60%), radial-gradient(40% 40% at 75% 70%, rgba(99,102,241,0.4), transparent 60%)',
        }}
      />
      <Card className="relative z-10 w-full max-w-md border-white/10 bg-white/95 backdrop-blur">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-teal-400 text-white shadow-lg shadow-primary/30">
            <BrandMark className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl font-extrabold tracking-tight">
            יצירת חשבון
          </CardTitle>
          <CardDescription>פתיחת חשבון מטופל ב-MediQ</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">שם מלא</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => update('full_name', e.target.value)}
                autoComplete="name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">טלפון (אופציונלי)</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                autoComplete="tel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">סיסמה</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              {loading ? 'יוצר חשבון…' : 'הרשמה'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              כבר רשום?{' '}
              <Link to="/login" className="font-medium text-primary hover:underline">
                כניסה
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
