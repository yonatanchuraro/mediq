import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { fmtDate, fmtTime } from '@/lib/datetime';
import { notifyWhatsapp } from '@/lib/notifications';
import type { AppointmentStatus } from '@/types/database.types';

interface AdminAppointmentRow {
  id: string;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  notes: string | null;
  service: { name: string };
  client: { full_name: string | null; email: string; phone: string | null } | null;
  doctor: { profile: { full_name: string | null } | null } | null;
  doctor_id: string;
}

interface DoctorOpt {
  profile_id: string;
  profile: { full_name: string | null } | null;
}

const ALL = '__all__';

export default function AdminAppointments() {
  const [rows, setRows] = useState<AdminAppointmentRow[]>([]);
  const [doctors, setDoctors] = useState<DoctorOpt[]>([]);
  const [doctorFilter, setDoctorFilter] = useState<string>(ALL);
  const [hours, setHours] = useState<WorkingHourSimple[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const apptsQuery = supabase
        .from('appointments')
        .select(
          `id, doctor_id, start_at, end_at, status, notes,
           service:services!service_id(name),
           client:profiles!client_id(full_name, email, phone),
           doctor:doctors!doctor_id(profile:profiles!profile_id(full_name))`
        )
        .order('start_at', { ascending: true });

      const [{ data: appts, error: aErr }, { data: docs, error: dErr }] = await Promise.all([
        doctorFilter === ALL ? apptsQuery : apptsQuery.eq('doctor_id', doctorFilter),
        supabase
          .from('doctors')
          .select('profile_id, profile:profiles!profile_id(full_name)')
          .eq('active', true),
      ]);

      if (aErr) {
        console.error('[AdminAppointments] appts error', aErr);
        toast.error(aErr.message);
      } else {
        setRows((appts ?? []) as unknown as AdminAppointmentRow[]);
      }
      if (dErr) {
        console.error('[AdminAppointments] doctors error', dErr);
      } else {
        setDoctors((docs ?? []) as unknown as DoctorOpt[]);
      }

      // Working hours: show working band only when filtering to a specific doctor
      if (doctorFilter !== ALL) {
        const { data: wh } = await supabase
          .from('working_hours')
          .select('weekday, start_time, end_time, is_open')
          .eq('doctor_id', doctorFilter);
        setHours((wh ?? []) as WorkingHourSimple[]);
      } else {
        setHours([]);
      }
    } catch (e) {
      console.error('[AdminAppointments] reload threw', e);
      toast.error(e instanceof Error ? e.message : 'טעינה נכשלה');
    }
  }, [doctorFilter]);

  useEffect(() => {
    reload();
  }, [reload]);

  const items = useMemo<CalendarAppointment[]>(
    () =>
      rows.map((r) => ({
        id: r.id,
        start_at: r.start_at,
        end_at: r.end_at,
        title: r.client?.full_name?.trim() || r.client?.email || 'מטופל',
        subtitle:
          (r.service.name ? r.service.name : '') +
          (r.doctor?.profile?.full_name ? ` · ${r.doctor.profile.full_name}` : ''),
        status: r.status,
      })),
    [rows]
  );

  const selected = rows.find((r) => r.id === selectedId);

  async function changeStatus(status: AppointmentStatus, successMsg: string) {
    if (!selected) return;
    const { error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', selected.id);
    if (error) return toast.error(error.message);
    toast.success(successMsg);
    if (status === 'cancelled') notifyWhatsapp(selected.id, 'cancellation');
    setSelectedId(null);
    reload();
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4">
      <PageHeader
        title="תורים"
        description="כל התורים במרפאה — תוכל לסנן לפי רופא"
        action={
          <Select value={doctorFilter} onValueChange={setDoctorFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="כל הרופאים" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>כל הרופאים</SelectItem>
              {doctors.map((d) => (
                <SelectItem key={d.profile_id} value={d.profile_id}>
                  {d.profile?.full_name?.trim() || 'רופא'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="min-h-0 flex-1">
        <AppointmentCalendar
          appointments={items}
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
                <DialogDescription>
                  {selected.service.name}
                  {selected.doctor?.profile?.full_name
                    ? ` · ${selected.doctor.profile.full_name}`
                    : ''}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <Row label="זמן">
                  {fmtDate(selected.start_at)} · {fmtTime(selected.start_at)}–{fmtTime(selected.end_at)}
                </Row>
                <Row label="טלפון">{selected.client?.phone ?? '—'}</Row>
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
                {selected.status === 'confirmed' && (() => {
                  const started = new Date(selected.start_at).getTime() <= Date.now();
                  return (
                    <>
                      {started && (
                        <Button variant="outline" onClick={() => changeStatus('no_show', 'סומן כלא הגיע')}>
                          לא הגיע
                        </Button>
                      )}
                      <Button variant="outline" onClick={() => changeStatus('cancelled', 'התור בוטל')}>
                        בטל תור
                      </Button>
                      {started ? (
                        <Button onClick={() => changeStatus('completed', 'התור סומן כהושלם')}>
                          סמן כהושלם
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          ניתן לסמן כהושלם רק אחרי שהתור החל
                        </span>
                      )}
                    </>
                  );
                })()}
                {(selected.status === 'cancelled' || selected.status === 'completed' || selected.status === 'no_show') && (
                  <Button
                    variant="outline"
                    onClick={() => changeStatus('confirmed', 'התור הוחזר למאושר')}
                  >
                    החזר כמאושר
                  </Button>
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
