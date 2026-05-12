import { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Service, Specialty } from '@/types/database.types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/layouts/AppShell';
import { cn } from '@/lib/utils';

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

interface FormState {
  name: string;
  description: string;
  duration_minutes: string;
  price_cents: string;
  specialty_id: string;
}

const ALL = '__all__';
const NONE = '__none__';
const empty: FormState = {
  name: '',
  description: '',
  duration_minutes: '20',
  price_cents: '',
  specialty_id: NONE,
};

export default function AdminServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Service | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>(ALL);

  async function load() {
    setLoading(true);
    try {
      const [{ data: svcs, error: sErr }, { data: specs, error: spErr }] = await Promise.all([
        supabase.from('services').select('*').eq('active', true).order('name'),
        supabase.from('specialties').select('*').eq('active', true).order('sort_order'),
      ]);
      if (sErr) toast.error(sErr.message);
      if (spErr) toast.error(spErr.message);
      setServices((svcs ?? []) as Service[]);
      setSpecialties((specs ?? []) as Specialty[]);
    } catch (e) {
      console.error('[AdminServices] load threw', e);
      toast.error(e instanceof Error ? e.message : 'טעינה נכשלה');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const specialtyById = useMemo(() => {
    const m = new Map<string, Specialty>();
    for (const s of specialties) m.set(s.id, s);
    return m;
  }, [specialties]);

  const filtered = useMemo(() => {
    if (filter === ALL) return services;
    if (filter === NONE) return services.filter((s) => !s.specialty_id);
    return services.filter((s) => s.specialty_id === filter);
  }, [services, filter]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...empty,
      specialty_id: filter !== ALL && filter !== NONE ? filter : NONE,
    });
    setDialogOpen(true);
  }

  function openEdit(s: Service) {
    setEditing(s);
    setForm({
      name: s.name,
      description: s.description ?? '',
      duration_minutes: String(s.duration_minutes),
      price_cents: s.price_cents != null ? String(Math.round(s.price_cents / 100)) : '',
      specialty_id: s.specialty_id ?? NONE,
    });
    setDialogOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const duration = Number(form.duration_minutes);
    if (!form.name.trim() || !duration || duration < 1) {
      toast.error('שם ומשך תקין הם חובה');
      return;
    }
    const priceCents = form.price_cents.trim()
      ? Math.round(Number(form.price_cents) * 100)
      : null;

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        duration_minutes: duration,
        price_cents: priceCents,
        specialty_id: form.specialty_id === NONE ? null : form.specialty_id,
      };
      const { error } = editing
        ? await supabase.from('services').update(payload).eq('id', editing.id)
        : await supabase.from('services').insert(payload);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(editing ? 'השירות עודכן' : 'השירות נוסף');
      setDialogOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(s: Service) {
    if (!confirm(`למחוק את "${s.name}"? פעולה זו תסיר אותו מהרשימה.`)) return;
    const { error } = await supabase.from('services').update({ active: false }).eq('id', s.id);
    if (error) return toast.error(error.message);
    toast.success('השירות הוסר');
    load();
  }

  return (
    <>
      <PageHeader
        title="סוגי טיפול"
        description="נהל את סוגי הביקור שמטופלים יכולים להזמין, מסונן לפי מחלקה"
        action={
          <div className="flex items-center gap-3">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="כל המחלקות" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>כל המחלקות</SelectItem>
                <SelectItem value={NONE}>ללא מחלקה</SelectItem>
                {specialties.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              סוג ביקור חדש
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              טוען…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 p-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Plus className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">
                {filter === ALL
                  ? 'אין סוגי טיפול עדיין'
                  : 'אין סוגי טיפול במחלקה הזו'}
              </h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                סוג ביקור מגדיר מה אפשר להזמין: שם, משך, מחיר ומחלקה משויכת.
              </p>
              <Button onClick={openCreate} className="mt-2">
                <Plus className="h-4 w-4" />
                צור סוג טיפול חדש
              </Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-3">שם</th>
                  <th className="px-6 py-3">מחלקה</th>
                  <th className="px-6 py-3">תיאור</th>
                  <th className="px-6 py-3">משך</th>
                  <th className="px-6 py-3">מחיר</th>
                  <th className="px-6 py-3 text-left">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((s) => {
                  const spec = s.specialty_id ? specialtyById.get(s.specialty_id) : null;
                  return (
                    <tr key={s.id} className="hover:bg-muted/30">
                      <td className="px-6 py-4 font-medium">{s.name}</td>
                      <td className="px-6 py-4">
                        {spec ? (
                          <span className="inline-flex items-center gap-2">
                            <span
                              className={cn(
                                'inline-block h-2.5 w-2.5 rounded-full',
                                COLOR_BG[spec.color] ?? 'bg-primary'
                              )}
                            />
                            {spec.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {s.description || <span className="text-muted-foreground/60">—</span>}
                      </td>
                      <td className="px-6 py-4 tabular-nums">{s.duration_minutes} דק׳</td>
                      <td className="px-6 py-4 tabular-nums">
                        {s.price_cents != null ? `₪${Math.round(s.price_cents / 100)}` : '—'}
                      </td>
                      <td className="px-6 py-4 text-left">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => remove(s)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'עריכת סוג טיפול' : 'סוג טיפול חדש'}</DialogTitle>
            <DialogDescription>
              {editing ? 'עדכן את פרטי סוג הטיפול.' : 'הוסף סוג טיפול חדש לרשימה.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="svc_name">שם</Label>
              <Input
                id="svc_name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="לדוגמה: בדיקה כללית"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="svc_spec">מחלקה</Label>
              <Select
                value={form.specialty_id}
                onValueChange={(v) => setForm({ ...form, specialty_id: v })}
              >
                <SelectTrigger id="svc_spec">
                  <SelectValue placeholder="בחר מחלקה" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>ללא מחלקה</SelectItem>
                  {specialties.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="svc_desc">תיאור (אופציונלי)</Label>
              <Textarea
                id="svc_desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="למה השירות מתאים, מה כולל…"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="svc_dur">משך (דקות)</Label>
                <Input
                  id="svc_dur"
                  type="number"
                  min="5"
                  step="5"
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="svc_price">מחיר ₪ (אופציונלי)</Label>
                <Input
                  id="svc_price"
                  type="number"
                  min="0"
                  step="1"
                  value={form.price_cents}
                  onChange={(e) => setForm({ ...form, price_cents: e.target.value })}
                  placeholder="—"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                ביטול
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                {editing ? 'שמור שינויים' : 'הוסף'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
