import { useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Specialty } from '@/types/database.types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

interface SpecRow extends Specialty {
  doctors_count: number;
  services_count: number;
}

const COLORS = [
  'teal',
  'amber',
  'rose',
  'sky',
  'pink',
  'red',
  'blue',
  'violet',
  'indigo',
  'cyan',
  'slate',
  'emerald',
];

const COLOR_CLASS: Record<string, string> = {
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
  slug: string;
  color: string;
}

const empty: FormState = { name: '', slug: '', color: 'teal' };

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9א-ת]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export default function AdminSpecialties() {
  const [rows, setRows] = useState<SpecRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Specialty | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [{ data: specs, error }, { data: docCounts }, { data: svcCounts }] =
        await Promise.all([
          supabase
            .from('specialties')
            .select('*')
            .eq('active', true)
            .order('sort_order'),
          supabase.from('doctors').select('specialty_id').eq('active', true),
          supabase.from('services').select('specialty_id').eq('active', true),
        ]);
      if (error) {
        toast.error(error.message);
      } else {
        const dc = new Map<string, number>();
        for (const d of docCounts ?? []) {
          if (d.specialty_id) dc.set(d.specialty_id, (dc.get(d.specialty_id) ?? 0) + 1);
        }
        const sc = new Map<string, number>();
        for (const s of svcCounts ?? []) {
          if (s.specialty_id) sc.set(s.specialty_id, (sc.get(s.specialty_id) ?? 0) + 1);
        }
        setRows(
          ((specs ?? []) as Specialty[]).map((s) => ({
            ...s,
            doctors_count: dc.get(s.id) ?? 0,
            services_count: sc.get(s.id) ?? 0,
          }))
        );
      }
    } catch (e) {
      console.error('[AdminSpecialties] load threw', e);
      toast.error(e instanceof Error ? e.message : 'טעינה נכשלה');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function openEdit(s: Specialty) {
    setEditing(s);
    setForm({ name: s.name, slug: s.slug, color: s.color });
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('שם הוא חובה');
      return;
    }
    const slug = form.slug.trim() || slugify(form.name);
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug,
        color: form.color,
      };
      const { error } = editing
        ? await supabase.from('specialties').update(payload).eq('id', editing.id)
        : await supabase.from('specialties').insert(payload);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(editing ? 'המחלקה עודכנה' : 'המחלקה נוספה');
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(s: SpecRow) {
    if (s.doctors_count > 0 || s.services_count > 0) {
      if (
        !confirm(
          `המחלקה "${s.name}" משויכת ל-${s.doctors_count} רופאים ו-${s.services_count} שירותים. למחוק בכל זאת?`
        )
      )
        return;
    } else if (!confirm(`למחוק את המחלקה "${s.name}"?`)) return;

    const { error } = await supabase
      .from('specialties')
      .update({ active: false })
      .eq('id', s.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('המחלקה הוסרה');
    load();
  }

  return (
    <>
      <PageHeader
        title="מחלקות"
        description="התמחויות רפואיות במרפאה — סנן רופאים ושירותים לפי מחלקה"
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            מחלקה חדשה
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          טוען…
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 p-16 text-center">
            <Plus className="h-8 w-8 text-muted-foreground/40" />
            <h3 className="text-lg font-semibold">אין מחלקות עדיין</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              צור מחלקה ראשונה (למשל "ילדים", "נשים") כדי לקטלג רופאים ושירותים.
            </p>
            <Button onClick={openCreate} className="mt-2">
              <Plus className="h-4 w-4" /> צור מחלקה
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((s) => (
            <Card
              key={s.id}
              className="group relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'h-10 w-10 shrink-0 rounded-xl shadow-md ring-1 ring-white/10',
                        COLOR_CLASS[s.color] ?? 'bg-primary'
                      )}
                    />
                    <div>
                      <div className="text-lg font-bold tracking-tight">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.slug}</div>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
                </div>
                <div className="mt-4 flex gap-4 text-sm">
                  <div>
                    <div className="text-2xl font-extrabold tabular-nums">{s.doctors_count}</div>
                    <div className="text-xs text-muted-foreground">רופאים</div>
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold tabular-nums">{s.services_count}</div>
                    <div className="text-xs text-muted-foreground">סוגי טיפול</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'עריכת מחלקה' : 'מחלקה חדשה'}</DialogTitle>
            <DialogDescription>
              מחלקה רפואית מקטלגת רופאים ושירותים יחד (למשל "נשים", "ילדים").
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="spec_name">שם</Label>
              <Input
                id="spec_name"
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                    slug: editing ? form.slug : slugify(e.target.value),
                  })
                }
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="spec_slug">מזהה (slug באנגלית, לשימוש פנימי)</Label>
              <Input
                id="spec_slug"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="family / pediatrics / ..."
              />
            </div>
            <div className="space-y-2">
              <Label>צבע</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={cn(
                      'h-8 w-8 rounded-lg transition-all',
                      COLOR_CLASS[c],
                      form.color === c
                        ? 'scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-background'
                        : 'opacity-70 hover:opacity-100'
                    )}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                ביטול
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                {editing ? 'שמור' : 'צור מחלקה'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
