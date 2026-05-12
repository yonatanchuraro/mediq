import { useEffect, useState } from 'react';
import { Loader2, KeyRound, UserCircle, AtSign } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth/AuthProvider';
import { PageHeader } from '@/components/layouts/AppShell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AdminSettings() {
  const { user, profile, refreshProfile } = useAuth();

  // Profile
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
    setPhone(profile?.phone ?? '');
  }, [profile]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
        })
        .eq('id', user.id)
        .select('id');
      if (error) {
        toast.error(`שמירה נכשלה: ${error.message}`);
        return;
      }
      if (!data || data.length === 0) {
        toast.error('שמירה נחסמה — נסה שוב או התחבר מחדש');
        return;
      }
      toast.success('הפרופיל נשמר');
      await refreshProfile();
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (newPassword.length < 6) {
      toast.error('הסיסמה החדשה חייבת להיות לפחות 6 תווים');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('הסיסמאות אינן תואמות');
      return;
    }
    setSavingPassword(true);
    try {
      // Verify current password by re-signing in
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword,
      });
      if (signErr) {
        toast.error('הסיסמה הנוכחית שגויה');
        return;
      }
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) {
        toast.error(`עדכון הסיסמה נכשל: ${updateErr.message}`);
        return;
      }
      toast.success('הסיסמה עודכנה');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } finally {
      setSavingPassword(false);
    }
  }

  const memberSince = user?.created_at
    ? format(new Date(user.created_at), "d בMMMM yyyy", { locale: he })
    : '—';

  return (
    <>
      <PageHeader
        title="הגדרות"
        description="פרטי פרופיל, חשבון ואבטחה"
      />

      <div className="grid max-w-3xl gap-6">
        {/* Profile */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">פרטים אישיים</h2>
            </div>
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="full_name">שם מלא</Label>
                  <Input
                    id="full_name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">טלפון</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={savingProfile}>
                  {savingProfile && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  שמור פרטים
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Account info (read-only) */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <AtSign className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">פרטי חשבון</h2>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <InfoRow label="אימייל" value={user?.email ?? '—'} />
              <InfoRow label="תפקיד" value={ROLE_HE[profile?.role ?? 'client']} />
              <InfoRow label="חבר/ה מאז" value={memberSince} />
              <InfoRow
                label="מזהה משתמש"
                value={
                  <code className="text-[11px] text-muted-foreground">
                    {user?.id.slice(0, 8)}…
                  </code>
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Change password */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">שינוי סיסמה</h2>
            </div>
            <form onSubmit={changePassword} className="space-y-4" autoComplete="off">
              <div className="space-y-2">
                <Label htmlFor="cur_pw">סיסמה נוכחית</Label>
                <Input
                  id="cur_pw"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new_pw">סיסמה חדשה</Label>
                  <Input
                    id="new_pw"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    autoComplete="new-password"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm_pw">אימות סיסמה חדשה</Label>
                  <Input
                    id="confirm_pw"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                לפחות 6 תווים. נסה לערב אותיות ומספרים.
              </p>
              <div className="flex justify-end">
                <Button type="submit" disabled={savingPassword}>
                  {savingPassword && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  עדכן סיסמה
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

const ROLE_HE: Record<string, string> = {
  admin: 'מנהל מערכת',
  doctor: 'רופא/ה',
  client: 'מטופל/ת',
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
