import { useEffect, useState } from 'react';
import { Loader2, Pencil, Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Doctor, Profile } from '@/types/database.types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/layouts/AppShell';

type DoctorRow = Doctor & {
  profile: Pick<Profile, 'id' | 'full_name' | 'email' | 'phone'>;
};

interface EditState {
  specialty: string;
  bio: string;
  license_number: string;
  active: boolean;
}

const emptyEdit: EditState = { specialty: '', bio: '', license_number: '', active: true };

export default function AdminDoctors() {
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [loading, setLoading] = useState(true);

  // edit
  const [editing, setEditing] = useState<DoctorRow | null>(null);
  const [editForm, setEditForm] = useState<EditState>(emptyEdit);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // promote
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteEmail, setPromoteEmail] = useState('');
  const [foundProfile, setFoundProfile] = useState<Profile | null>(null);
  const [searching, setSearching] = useState(false);
  const [promoteForm, setPromoteForm] = useState<EditState>(emptyEdit);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('doctors')
      .select('*, profile:profiles!profile_id(id, full_name, email, phone)')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      setDoctors((data ?? []) as DoctorRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // ── Edit ──────────────────────────────────────────────
  function openEdit(d: DoctorRow) {
    setEditing(d);
    setEditForm({
      specialty: d.specialty ?? '',
      bio: d.bio ?? '',
      license_number: d.license_number ?? '',
      active: d.active,
    });
    setEditOpen(true);
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from('doctors')
      .update({
        specialty: editForm.specialty.trim() || null,
        bio: editForm.bio.trim() || null,
        license_number: editForm.license_number.trim() || null,
        active: editForm.active,
      })
      .eq('profile_id', editing.profile_id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('הרופא עודכן');
    setEditOpen(false);
    load();
  }

  // ── Promote a user to doctor ──────────────────────────
  function openPromote() {
    setPromoteEmail('');
    setFoundProfile(null);
    setPromoteForm(emptyEdit);
    setPromoteOpen(true);
  }

  async function searchProfile() {
    const email = promoteEmail.trim().toLowerCase();
    if (!email) return;
    setSearching(true);
    setFoundProfile(null);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .ilike('email', email)
      .maybeSingle();
    setSearching(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data) {
      toast.error('לא נמצא משתמש עם המייל הזה. שיירשם דרך /signup קודם.');
      return;
    }
    if (data.role === 'doctor') {
      toast.error('המשתמש כבר רופא');
      return;
    }
    setFoundProfile(data as Profile);
  }

  async function submitPromote(e: React.FormEvent) {
    e.preventDefault();
    if (!foundProfile) return;
    setSaving(true);

    const { error: roleErr } = await supabase
      .from('profiles')
      .update({ role: 'doctor' })
      .eq('id', foundProfile.id);
    if (roleErr) {
      setSaving(false);
      toast.error(`לא הצלחנו לעדכן role: ${roleErr.message}`);
      return;
    }

    const { error: insertErr } = await supabase.from('doctors').insert({
      profile_id: foundProfile.id,
      specialty: promoteForm.specialty.trim() || null,
      bio: promoteForm.bio.trim() || null,
      license_number: promoteForm.license_number.trim() || null,
      active: promoteForm.active,
    });

    setSaving(false);
    if (insertErr) {
      // try to rollback role change
      await supabase.from('profiles').update({ role: 'client' }).eq('id', foundProfile.id);
      toast.error(`לא הצלחנו ליצור רשומת רופא: ${insertErr.message}`);
      return;
    }
    toast.success(`${foundProfile.full_name} קודם לרופא`);
    setPromoteOpen(false);
    load();
  }

  return (
    <>
      <PageHeader
        title="רופאים"
        description="ניהול רופאי המרפאה — התמחות, ביו, רישיון וסטטוס"
        action={
          <Button onClick={openPromote}>
            <UserPlus className="h-4 w-4" />
            הוסף רופא
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              טוען…
            </div>
          ) : doctors.length === 0 ? (
            <EmptyState onAdd={openPromote} />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-3">שם</th>
                  <th className="px-6 py-3">התמחות</th>
                  <th className="px-6 py-3">פרטים</th>
                  <th className="px-6 py-3">סטטוס</th>
                  <th className="px-6 py-3 text-left">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {doctors.map((d) => (
                  <tr key={d.profile_id} className="hover:bg-muted/30">
                    <td className="px-6 py-4">
                      <div className="font-medium">{d.profile.full_name}</div>
                      <div className="text-xs text-muted-foreground">{d.profile.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      {d.specialty || <span className="text-muted-foreground/60">—</span>}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {d.profile.phone ? <div>📞 {d.profile.phone}</div> : null}
                      {d.license_number ? (
                        <div className="text-xs">רישיון: {d.license_number}</div>
                      ) : null}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={
                          d.active
                            ? 'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700'
                            : 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
                        }
                      >
                        {d.active ? 'פעיל' : 'לא פעיל'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-left">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(d)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>עריכת רופא</DialogTitle>
            <DialogDescription>
              {editing?.profile.full_name} · {editing?.profile.email}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <DoctorFields form={editForm} setForm={setEditForm} />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={saving}
              >
                ביטול
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                שמור
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Promote dialog */}
      <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>הוספת רופא</DialogTitle>
            <DialogDescription>
              המשתמש צריך להירשם קודם דרך עמוד ההרשמה. כאן מוצאים אותו לפי מייל וקובעים אותו כרופא.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitPromote} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="searchEmail">חיפוש לפי מייל</Label>
              <div className="flex gap-2">
                <Input
                  id="searchEmail"
                  type="email"
                  value={promoteEmail}
                  onChange={(e) => setPromoteEmail(e.target.value)}
                  placeholder="doctor@example.com"
                  disabled={!!foundProfile}
                />
                {!foundProfile && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={searchProfile}
                    disabled={searching || !promoteEmail.trim()}
                  >
                    {searching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    חפש
                  </Button>
                )}
              </div>
            </div>

            {foundProfile && (
              <>
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <div className="font-medium">{foundProfile.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {foundProfile.email}
                    {foundProfile.phone ? ` · ${foundProfile.phone}` : ''}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    תפקיד נוכחי: {foundProfile.role === 'client' ? 'מטופל' : foundProfile.role}
                  </div>
                </div>
                <DoctorFields form={promoteForm} setForm={setPromoteForm} />
              </>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPromoteOpen(false)}
                disabled={saving}
              >
                ביטול
              </Button>
              <Button type="submit" disabled={!foundProfile || saving}>
                {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                קדם לרופא
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DoctorFields({
  form,
  setForm,
}: {
  form: EditState;
  setForm: (s: EditState) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="specialty">התמחות</Label>
        <Input
          id="specialty"
          value={form.specialty}
          onChange={(e) => setForm({ ...form, specialty: e.target.value })}
          placeholder="למשל: רופא משפחה, קרדיולוג"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bio">ביו (מוצג למטופלים)</Label>
        <Textarea
          id="bio"
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          placeholder="תיאור קצר על הרופא"
          rows={2}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="license">מס׳ רישיון</Label>
        <Input
          id="license"
          value={form.license_number}
          onChange={(e) => setForm({ ...form, license_number: e.target.value })}
        />
      </div>
      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <Label htmlFor="active" className="text-sm">
            פעיל
          </Label>
          <p className="text-xs text-muted-foreground">
            כשמושבת — לא ניתן יהיה לקבוע תורים אצל הרופא
          </p>
        </div>
        <Switch
          id="active"
          checked={form.active}
          onCheckedChange={(v) => setForm({ ...form, active: v })}
        />
      </div>
    </>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <UserPlus className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold">אין רופאים עדיין</h3>
      <p className="max-w-sm text-sm text-muted-foreground">
        בקש מהרופא להירשם בעמוד ה-Signup, ואז קדם אותו כאן עם המייל שלו.
      </p>
      <Button onClick={onAdd} className="mt-2">
        <UserPlus className="h-4 w-4" />
        הוסף רופא
      </Button>
    </div>
  );
}
