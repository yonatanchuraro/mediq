import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth/AuthProvider';
import { PageHeader } from '@/components/layouts/AppShell';
import {
  AppointmentCalendar,
  type CalendarAppointment,
  type WorkingHourSimple,
} from '@/components/calendar/AppointmentCalendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { fmtDate, fmtTime } from '@/lib/datetime';
import type { AppointmentStatus } from '@/types/database.types';

interface DoctorAppointmentRow {
  id: string;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  notes: string | null;
  service: { name: string; duration_minutes: number };
  client: { full_name: string | null; email: string; phone: string | null } | null;
}

export default function DoctorCalendar() {
  const { user } = useAuth();
  const [rows, setRows] = useState<DoctorAppointmentRow[]>([]);
  const [hours, setHours] = useState<WorkingHourSimple[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) return;
    try {
      const [{ data: appts, error: aErr }, { data: wh, error: wErr }] = await Promise.all([
        supabase
          .from('appointments')
          .select(
            `id, start_at, end_at, status, notes,
             service:services!service_id(name, duration_minutes),
             client:profiles!client_id(full_name, email, phone)`
          )
          .eq('doctor_id', user.id)
          .order('start_at', { ascending: true }),
        supabase
          .from('working_hours')
          .select('weekday, start_time, end_time, is_open')
          .eq('doctor_id', user.id),
      ]);
      if (aErr) {
        console.error('[DoctorCalendar] appointments error', aErr);
        toast.error(aErr.message);
      } else {
        setRows((appts ?? []) as unknown as DoctorAppointmentRow[]);
      }
      if (wErr) {
        console.error('[DoctorCalendar] hours error', wErr);
      } else {
        setHours((wh ?? []) as WorkingHourSimple[]);
      }
    } catch (e) {
      console.error('[DoctorCalendar] reload threw', e);
      toast.error(e instanceof Error ? e.message : 'טעינה נכשלה');
    }
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  const calendarItems = useMemo<CalendarAppointment[]>(
    () =>
      rows.map((r) => ({
        id: r.id,
        start_at: r.start_at,
        end_at: r.end_at,
        title: r.client?.full_name?.trim() || r.client?.email || 'מטופל',
        subtitle: r.service.name,
        status: r.status,
      })),
    [rows]
  );

  const selected = rows.find((r) => r.id === selectedId);

  const todayCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return rows.filter((r) => {
      const d = new Date(r.start_at);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime() && r.status !== 'cancelled';
    }).length;
  }, [rows]);

  async function changeStatus(status: AppointmentStatus, successMsg: string) {
    if (!selected) return;
    const { error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', selected.id);
    if (error) return toast.error(error.message);
    toast.success(successMsg);
    setSelectedId(null);
    reload();
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4">
      <PageHeader
        title="היומן שלי"
        description={
          todayCount > 0 ? `${todayCount} תורים היום` : 'אין תורים היום'
        }
      />

      <div className="min-h-0 flex-1">
        <AppointmentCalendar
          appointments={calendarItems}
          workingHours={hours}
          onEventClick={(id) => setSelectedId(id)}
        />
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selected.client?.full_name?.trim() || selected.client?.email || 'מטופל'}
                </DialogTitle>
                <DialogDescription>{selected.service.name}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <Row label="זמן">
                  {fmtDate(selected.start_at)} · {fmtTime(selected.start_at)}–{fmtTime(selected.end_at)}
                </Row>
                <Row label="טלפון">
                  {selected.client?.phone ? (
                    <a
                      href={`tel:${selected.client.phone}`}
                      className="text-primary hover:underline"
                    >
                      {selected.client.phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </Row>
                <Row label="מייל">{selected.client?.email ?? '—'}</Row>
                <Row label="סטטוס">{STATUS_HE[selected.status]}</Row>
                {selected.notes && <Row label="הערות">{selected.notes}</Row>}
              </div>
              <DialogFooter className="flex-wrap gap-2 sm:justify-end">
                {selected.status === 'pending' && (
                  <>
                    <Button variant="outline" onClick={() => changeStatus('cancelled', 'התור בוטל')}>
                      בטל תור
                    </Button>
                    <Button onClick={() => changeStatus('confirmed', 'התור אושר')}>
                      אשר תור
                    </Button>
                  </>
                )}
                {selected.status === 'confirmed' && (
                  <>
                    <Button variant="outline" onClick={() => changeStatus('no_show', 'סומן כלא הגיע')}>
                      לא הגיע
                    </Button>
                    <Button variant="outline" onClick={() => changeStatus('cancelled', 'התור בוטל')}>
                      בטל תור
                    </Button>
                    <Button onClick={() => changeStatus('completed', 'התור סומן כהושלם')}>
                      סמן כהושלם
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const STATUS_HE: Record<AppointmentStatus, string> = {
  pending: 'ממתין לאישור',
  confirmed: 'מאושר',
  cancelled: 'בוטל',
  completed: 'הושלם',
  no_show: 'לא הגיע',
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{children}</span>
    </div>
  );
}
