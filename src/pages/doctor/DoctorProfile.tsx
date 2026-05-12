import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth/AuthProvider';
import { PageHeader } from '@/components/layouts/AppShell';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface Form {
  full_name: string;
  phone: string;
  specialty: string;
  bio: string;
  license_number: string;
}

const empty: Form = {
  full_name: '',
  phone: '',
  specialty: '',
  bio: '',
  license_number: '',
};

export default function DoctorProfile() {
  const { user, refreshProfile } = useAuth();
  const [form, setForm] = useState<Form>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [{ data: profile, error: pErr }, { data: doctor, error: dErr }] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('doctors')
          .select('specialty, bio, license_number')
          .eq('profile_id', user.id)
          .maybeSingle(),
      ]);
      if (pErr) toast.error(pErr.message);
      if (dErr) toast.error(dErr.message);
      setForm({
        full_name: profile?.full_name ?? '',
        phone: profile?.phone ?? '',
        specialty: doctor?.specialty ?? '',
        bio: doctor?.bio ?? '',
        license_number: doctor?.license_number ?? '',
      });
    } catch (e) {
      console.error('[DoctorProfile] load threw', e);
      toast.error(e instanceof Error ? e.message : 'טעינה נכשלה');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const { error: pErr } = await supabase
        .from('profiles')
        .update({
          full_name: form.full_name.trim() || null,
          phone: form.phone.trim() || null,
        })
        .eq('id', user.id);
      if (pErr) {
        console.error('[DoctorProfile] profile update error', pErr);
        toast.error(pErr.message);
        return;
      }
      const { error: dErr } = await supabase
        .from('doctors')
        .update({
          specialty: form.specialty.trim() || null,
          bio: form.bio.trim() || null,
          license_number: form.license_number.trim() || null,
        })
        .eq('profile_id', user.id);
      if (dErr) {
        console.error('[DoctorProfile] doctor update error', dErr);
        toast.error(dErr.message);
        return;
      }
      toast.success('הפרופיל נשמר');
      await refreshProfile();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="פרופיל" description="פרטים אישיים והתמחות מקצועית" />
      {loading ? (
        <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          טוען…
        </div>
      ) : (
        <Card className="max-w-2xl">
          <CardContent className="p-6">
            <form onSubmit={save} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dp_name">שם מלא</Label>
                  <Input
                    id="dp_name"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dp_phone">טלפון</Label>
                  <Input
                    id="dp_phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dp_specialty">התמחות</Label>
                <Input
                  id="dp_specialty"
                  value={form.specialty}
                  onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dp_license">מס׳ רישיון</Label>
                <Input
                  id="dp_license"
                  value={form.license_number}
                  onChange={(e) => setForm({ ...form, license_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dp_bio">ביו (מוצג למטופלים)</Label>
                <Textarea
                  id="dp_bio"
                  rows={3}
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  שמור
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </>
  );
}
