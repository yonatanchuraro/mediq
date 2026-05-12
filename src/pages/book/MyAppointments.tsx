import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, Loader2, Plus, Stethoscope, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth/AuthProvider';
import type { AppointmentStatus } from '@/types/database.types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/layouts/AppShell';
import { fmtDate, fmtTime, isPast } from '@/lib/datetime';

interface AppointmentRow {
  id: string;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  notes: string | null;
  service: { name: string; duration_minutes: number };
  // doctor_id FK → doctors.profile_id → profiles.id (two hops, see select below)
  doctor: { profile: { full_name: string; phone: string | null } };
}

const STATUS_LABELS: Record<AppointmentStatus, { label: string; className: string }> = {
  pending: { label: 'ממתין לאישור', className: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'מאושר', className: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'בוטל', className: 'bg-muted text-muted-foreground' },
  completed: { label: 'הושלם', className: 'bg-blue-100 text-blue-800' },
  no_show: { label: 'לא הגיע', className: 'bg-rose-100 text-rose-800' },
};

export default function MyAppointments() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) return;
    setLoading(true);
    // appointments.doctor_id FK is on doctors(profile_id), so we hop through
    // doctors to reach profiles. The direct join `profiles!doctor_id` errors
    // with "Could not find a relationship between appointments and profiles".
    const { data, error } = await supabase
      .from('appointments')
      .select(
        `*,
         service:services!service_id(name, duration_minutes),
         doctor:doctors!doctor_id(
           profile:profiles!profile_id(full_name, phone)
         )`
      )
      .eq('client_id', user.id)
      .order('start_at', { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      setRows((data ?? []) as AppointmentRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [user?.id]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up: AppointmentRow[] = [];
    const pa: AppointmentRow[] = [];
    for (const r of rows) {
      if (r.status === 'cancelled' || new Date(r.end_at).getTime() < now) {
        pa.push(r);
      } else {
        up.push(r);
      }
    }
    up.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
    return { upcoming: up, past: pa };
  }, [rows]);

  async function cancel(id: string) {
    if (!confirm('לבטל את התור?')) return;
    // Adding .select() so we can detect the silent-RLS case: update
    // succeeds at the SQL level but affects zero rows because the policy
    // USING clause didn't match. Without this we get a fake "success".
    const { data, error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select('id, status');
    if (error) {
      console.error('[cancel] update error:', error);
      toast.error(`ביטול נכשל: ${error.message}`);
      return;
    }
    if (!data || data.length === 0) {
      console.warn('[cancel] zero rows updated — RLS likely blocked');
      toast.error('לא ניתן לבטל את התור הזה — ייתכן שהוא כבר בוטל או שאין לך הרשאה');
      return;
    }
    toast.success('התור בוטל');
    load();
  }

  return (
    <>
      <PageHeader
        title="התורים שלי"
        description="תורים קרובים והיסטוריה"
        action={
          <Button asChild>
            <Link to="/book/new">
              <Plus className="h-4 w-4" />
              תור חדש
            </Link>
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          טוען…
        </div>
      ) : rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              קרובים {upcoming.length > 0 && `(${upcoming.length})`}
            </h2>
            {upcoming.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  אין תורים קרובים.{' '}
                  <Link to="/book/new" className="font-medium text-primary hover:underline">
                    קבע תור חדש
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {upcoming.map((a) => (
                  <AppointmentCard key={a.id} a={a} onCancel={() => cancel(a.id)} />
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                היסטוריה
              </h2>
              <div className="grid gap-3">
                {past.map((a) => (
                  <AppointmentCard key={a.id} a={a} dim />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}

function AppointmentCard({
  a,
  onCancel,
  dim,
}: {
  a: AppointmentRow;
  onCancel?: () => void;
  dim?: boolean;
}) {
  const status = STATUS_LABELS[a.status];
  return (
    <Card className={dim ? 'opacity-75' : undefined}>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-teal-400 text-white shadow-md shadow-primary/30">
          <Calendar className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">{a.service.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>
              {status.label}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {fmtDate(a.start_at)} · {fmtTime(a.start_at)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Stethoscope className="h-3.5 w-3.5" />
              {a.doctor?.profile?.full_name ?? 'רופא'}
            </span>
          </div>
          {a.notes && (
            <div className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium">הערות:</span> {a.notes}
            </div>
          )}
        </div>
        {onCancel &&
          !isPast(a.start_at) &&
          (a.status === 'pending' || a.status === 'confirmed') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-4 w-4" />
              בטל
            </Button>
          )}
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 p-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-teal-400 text-white shadow-lg shadow-primary/30">
          <Calendar className="h-6 w-6" />
        </div>
        <h3 className="text-xl font-bold">אין לך תורים עדיין</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          קבע את התור הראשון שלך — בחר שירות, רופא וזמן שמתאים לך.
        </p>
        <Button asChild className="mt-2">
          <Link to="/book/new">
            <Plus className="h-4 w-4" />
            קבע תור חדש
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
