import { useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Service } from '@/types/database.types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/layouts/AppShell';

interface FormState {
  name: string;
  description: string;
  duration_minutes: string;
  price_cents: string;
}

const empty: FormState = { name: '', description: '', duration_minutes: '20', price_cents: '' };

export default function AdminServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Service | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('active', true)
      .order('name');
    if (error) {
      toast.error(error.message);
    } else {
      setServices((data ?? []) as Service[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(empty);
    setDialogOpen(true);
  }

  function openEdit(s: Service) {
    setEditing(s);
    setForm({
      name: s.name,
      description: s.description ?? '',
      duration_minutes: String(s.duration_minutes),
      price_cents: s.price_cents != null ? String(Math.round(s.price_cents / 100)) : '',
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
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      duration_minutes: duration,
      price_cents: priceCents,
    };

    const { error } = editing
      ? await supabase.from('services').update(payload).eq('id', editing.id)
      : await supabase.from('services').insert(payload);

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? 'השירות עודכן' : 'השירות נוסף');
    setDialogOpen(false);
    load();
  }

  async function remove(s: Service) {
    if (!confirm(`למחוק את "${s.name}"? פעולה זו תסיר אותו מהרשימה.`)) return;
    const { error } = await supabase.from('services').update({ active: false }).eq('id', s.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('השירות הוסר');
    load();
  }

  return (
    <>
      <PageHeader
        title="סוגי ביקור"
        description="נהל את סוגי הביקור שמטופלים יכולים להזמין"
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            סוג ביקור חדש
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
          ) : services.length === 0 ? (
            <EmptyState onCreate={openCreate} />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-3">שם</th>
                  <th className="px-6 py-3">תיאור</th>
                  <th className="px-6 py-3">משך</th>
                  <th className="px-6 py-3">מחיר</th>
                  <th className="px-6 py-3 text-left">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {services.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="px-6 py-4 font-medium">{s.name}</td>
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
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'עריכת סוג ביקור' : 'סוג ביקור חדש'}</DialogTitle>
            <DialogDescription>
              {editing ? 'עדכן את פרטי סוג הביקור.' : 'הוסף סוג ביקור חדש לרשימה.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">שם השירות</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="לדוגמה: בדיקה כללית"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">תיאור (אופציונלי)</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="למה השירות מתאים, מה כולל…"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="duration">משך (דקות)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="5"
                  step="5"
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">מחיר ₪ (אופציונלי)</Label>
                <Input
                  id="price"
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

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Plus className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold">אין סוגי ביקור עדיין</h3>
      <p className="max-w-sm text-sm text-muted-foreground">
        סוג ביקור מגדיר מה אפשר להזמין: שם, משך זמן ומחיר (אופציונלי).
      </p>
      <Button onClick={onCreate} className="mt-2">
        <Plus className="h-4 w-4" />
        צור סוג ביקור ראשון
      </Button>
    </div>
  );
}
