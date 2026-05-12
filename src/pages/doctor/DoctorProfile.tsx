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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Specialty } from '@/types/database.types';
import { cn } from '@/lib/utils';

interface Form {
  full_name: string;
  phone: string;
  specialty_id: string;
  bio: string;
  license_number: string;
}

const NONE = '__none__';
const empty: Form = {
  full_name: '',
  phone: '',
  specialty_id: NONE,
  bio: '',
  license_number: '',
};

const COLOR_BG: Record<string, string> = {
  teal: 'bg-teal-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  sky: 'bg-sky-500',
  pink: 'bg-pink-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  violet: 'bg-violet-500',
  indigo: 'bg-indigo-500',
  cyan: 'bg-cyan-500',
  slate: 'bg-slate-500',
  emerald: 'bg-emerald-500',
};

export default function DoctorProfile() {
  const { user, refreshProfile } = useAuth();
  const [form, setForm] = useState<Form>(empty);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [profileRes, doctorRes, specsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('doctors')
          .select('specialty_id, bio, license_number')
          .eq('profile_id', user.id)
          .maybeSingle(),
        supabase
          .from('specialties')
          .select('*')
          .eq('active', true)
          .order('sort_order'),
      ]);
      if (profileRes.error) toast.error(profileRes.error.message);
      if (doctorRes.error) toast.error(doctorRes.error.message);
      if (specsRes.error) toast.error(specsRes.error.message);
      setForm({
        full_name: profileRes.data?.full_name ?? '',
        phone: profileRes.data?.phone ?? '',
        specialty_id: doctorRes.data?.specialty_id ?? NONE,
        bio: doctorRes.data?.bio ?? '',
        license_number: doctorRes.data?.license_number ?? '',
      });
      setSpecialties((specsRes.data ?? []) as Specialty[]);
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
          specialty_id: form.specialty_id === NONE ? null : form.specialty_id,
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
      <PageHeader title="פרופיל" description="פרטים אישיים ומחלקה מקצועית" />
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
                <Label htmlFor="dp_specialty">מחלקה / התמחות</Label>
                <Select
                  value={form.specialty_id}
                  onValueChange={(v) => setForm({ ...form, specialty_id: v })}
                >
                  <SelectTrigger id="dp_specialty">
                    <SelectValue placeholder="בחר מחלקה" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>ללא מחלקה</SelectItem>
                    {specialties.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className={cn(
                              'inline-block h-2.5 w-2.5 rounded-full',
                              COLOR_BG[s.color] ?? 'bg-primary'
                            )}
                          />
                          {s.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  המחלקה מנוהלת מעמוד "מחלקות" של האדמין.
                </p>
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
