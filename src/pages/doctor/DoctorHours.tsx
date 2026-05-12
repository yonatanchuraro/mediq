import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth/AuthProvider';
import { PageHeader } from '@/components/layouts/AppShell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const WEEKDAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

interface Row {
  weekday: number;
  start_time: string;
  end_time: string;
  is_open: boolean;
}

const DEFAULT_ROWS: Row[] = [
  { weekday: 0, start_time: '09:00', end_time: '17:00', is_open: true },
  { weekday: 1, start_time: '09:00', end_time: '17:00', is_open: true },
  { weekday: 2, start_time: '09:00', end_time: '17:00', is_open: true },
  { weekday: 3, start_time: '09:00', end_time: '17:00', is_open: true },
  { weekday: 4, start_time: '09:00', end_time: '17:00', is_open: true },
  { weekday: 5, start_time: '09:00', end_time: '13:00', is_open: true },
  { weekday: 6, start_time: '09:00', end_time: '17:00', is_open: false },
];

export default function DoctorHours() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>(DEFAULT_ROWS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('working_hours')
        .select('weekday, start_time, end_time, is_open')
        .eq('doctor_id', user.id);
      if (error) {
        console.error('[DoctorHours] load error', error);
        toast.error(error.message);
        return;
      }
      const map = new Map<number, Row>();
      for (const r of data ?? []) {
        map.set(r.weekday, {
          weekday: r.weekday,
          start_time: r.start_time ?? '09:00',
          end_time: r.end_time ?? '17:00',
          is_open: r.is_open,
        });
      }
      // fill any missing day with default
      const full = DEFAULT_ROWS.map((d) => map.get(d.weekday) ?? d);
      setRows(full);
    } catch (e) {
      console.error('[DoctorHours] load threw', e);
      toast.error(e instanceof Error ? e.message : 'טעינה נכשלה');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  function update(weekday: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)));
  }

  async function save() {
    if (!user) return;
    // validate
    for (const r of rows) {
      if (r.is_open && r.start_time >= r.end_time) {
        toast.error(`${WEEKDAYS_HE[r.weekday]}: שעת סיום חייבת להיות אחרי שעת ההתחלה`);
        return;
      }
    }
    setSaving(true);
    try {
      // upsert each row keyed by (doctor_id, weekday). The unique constraint
      // on (doctor_id, weekday) makes this safe — we wipe + reinsert per row.
      const { error: delErr } = await supabase
        .from('working_hours')
        .delete()
        .eq('doctor_id', user.id);
      if (delErr) {
        console.error('[DoctorHours] delete error', delErr);
        toast.error(delErr.message);
        return;
      }
      const payload = rows.map((r) => ({
        doctor_id: user.id,
        weekday: r.weekday,
        start_time: r.is_open ? r.start_time : null,
        end_time: r.is_open ? r.end_time : null,
        is_open: r.is_open,
      }));
      const { error } = await supabase.from('working_hours').insert(payload);
      if (error) {
        console.error('[DoctorHours] insert error', error);
        toast.error(error.message);
        return;
      }
      toast.success('שעות העבודה נשמרו');
    } catch (e) {
      console.error('[DoctorHours] save threw', e);
      toast.error(e instanceof Error ? e.message : 'שמירה נכשלה');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="שעות עבודה"
        description="הגדר את הימים והשעות שבהם תהיה זמין לקבלת תורים"
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          טוען…
        </div>
      ) : (
        <Card className="max-w-2xl">
          <CardContent className="p-6">
            <div className="space-y-2">
              {rows.map((r) => (
                <div
                  key={r.weekday}
                  className="grid grid-cols-[100px_1fr_1fr_60px] items-center gap-3 rounded-lg border bg-card p-3"
                >
                  <Label className="font-medium">יום {WEEKDAYS_HE[r.weekday]}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">משעה</span>
                    <Input
                      type="time"
                      value={r.start_time}
                      onChange={(e) => update(r.weekday, { start_time: e.target.value })}
                      disabled={!r.is_open}
                      className="h-8 w-28"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">עד</span>
                    <Input
                      type="time"
                      value={r.end_time}
                      onChange={(e) => update(r.weekday, { end_time: e.target.value })}
                      disabled={!r.is_open}
                      className="h-8 w-28"
                    />
                  </div>
                  <Switch
                    checked={r.is_open}
                    onCheckedChange={(v) => update(r.weekday, { is_open: v })}
                  />
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                שמור שעות עבודה
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
