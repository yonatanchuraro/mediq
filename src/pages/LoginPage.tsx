import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
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
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'התחברות נכשלה');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b1020] px-4">
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
          <CardTitle className="bg-gradient-to-br from-primary to-teal-400 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
            MediQ
          </CardTitle>
          <CardDescription>מערכת ניהול תורי מרפאה</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">סיסמה</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              {loading ? 'מתחבר…' : 'כניסה'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              עדיין אין לך חשבון?{' '}
              <Link to="/signup" className="font-medium text-primary hover:underline">
                הרשמה
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
