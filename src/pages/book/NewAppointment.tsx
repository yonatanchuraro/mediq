import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth/AuthProvider';
import type { Service } from '@/types/database.types';
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
import { PageHeader } from '@/components/layouts/AppShell';
import { roundToNextQuarter, toLocalInput } from '@/lib/datetime';
import { notifyWhatsapp } from '@/lib/notifications';

interface DoctorOption {
  profile_id: string;
  specialty_id: string | null;
  bio: string | null;
  profile: { full_name: string | null } | null;
  specialty: { name: string | null; color: string } | null;
}

function doctorName(d: DoctorOption): string {
  return d.profile?.full_name?.trim() || 'רופא';
}

function doctorSpecialty(d: DoctorOption): string | null {
  return d.specialty?.name?.trim() || null;
}

export default function NewAppointment() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [services, setServices] = useState<Service[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [doctorServices, setDoctorServices] = useState<{ doctor_id: string; service_id: string }[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [serviceId, setServiceId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [startAt, setStartAt] = useState(toLocalInput(roundToNextQuarter()));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [
          { data: svcs, error: svcErr },
          { data: docs, error: docErr },
          { data: ds, error: dsErr },
        ] = await Promise.all([
          supabase.from('services').select('*').eq('active', true).order('name'),
          supabase
            .from('doctors')
            .select(
              'profile_id, specialty_id, bio, profile:profiles!profile_id(full_name), specialty:specialties!specialty_id(name, color)'
            )
            .eq('active', true)
            .order('created_at', { ascending: false }),
          supabase.from('doctor_services').select('doctor_id, service_id'),
        ]);
        if (cancelled) return;
        if (svcErr) {
          console.error('[NewAppointment] services error:', svcErr);
          toast.error(`טעינת שירותים נכשלה: ${svcErr.message}`);
        }
        if (docErr) {
          console.error('[NewAppointment] doctors error:', docErr);
          toast.error(`טעינת רופאים נכשלה: ${docErr.message}`);
        }
        if (dsErr) {
          console.error('[NewAppointment] doctor_services error:', dsErr);
        }
        setServices((svcs ?? []) as Service[]);
        setDoctors((docs ?? []) as unknown as DoctorOption[]);
        setDoctorServices((ds ?? []) as { doctor_id: string; service_id: string }[]);
      } catch (e) {
        if (cancelled) return;
        console.error('[NewAppointment] load failed:', e);
        toast.error(e instanceof Error ? e.message : 'טעינה נכשלה');
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedService = services.find((s) => s.id === serviceId);

  // Filter doctors by the chosen service. If no doctor_services mapping
  // exists for that service yet, fall back to all doctors so the form
  // doesn't become unusable.
  const filteredDoctors = useMemo(() => {
    if (!serviceId) return doctors;
    const allowed = new Set(
      doctorServices.filter((m) => m.service_id === serviceId).map((m) => m.doctor_id)
    );
    if (allowed.size === 0) return doctors;
    return doctors.filter((d) => allowed.has(d.profile_id));
  }, [doctors, doctorServices, serviceId]);

  // Reset doctor selection when service changes and current doctor isn't compatible.
  useEffect(() => {
    if (doctorId && !filteredDoctors.some((d) => d.profile_id === doctorId)) {
      setDoctorId('');
    }
  }, [filteredDoctors, doctorId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !selectedService) return;

    const start = new Date(startAt);
    if (Number.isNaN(start.getTime())) {
      toast.error('תאריך לא תקין');
      return;
    }
    if (start.getTime() < Date.now()) {
      toast.error('לא ניתן לקבוע תור לעבר');
      return;
    }

    const end = new Date(start.getTime() + selectedService.duration_minutes * 60_000);

    setSubmitting(true);
    const { data: created, error } = await supabase
      .from('appointments')
      .insert({
        client_id: user.id,
        doctor_id: doctorId,
        service_id: serviceId,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        notes: notes.trim() || null,
        created_by: user.id,
        status: 'pending',
      })
      .select('id')
      .single();
    setSubmitting(false);

    if (error) {
      if (error.code === '23P01' || error.message.toLowerCase().includes('overlap')) {
        toast.error('הזמן שבחרת תפוס. נסה זמן אחר.');
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success('התור נקבע');
    if (created?.id) notifyWhatsapp(created.id, 'confirmation');
    navigate('/book');
  }

  if (loadingMeta) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        טוען…
      </div>
    );
  }

  const noResources = services.length === 0 || doctors.length === 0;

  return (
    <>
      <PageHeader title="קביעת תור חדש" description="בחר שירות, רופא וזמן" />

      {noResources ? (
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            <p>
              {services.length === 0
                ? 'אין סוגי ביקור פעילים במרפאה כרגע.'
                : 'אין רופאים פעילים במרפאה כרגע.'}
            </p>
            <p className="mt-2 text-xs">פנה לאדמין המרפאה.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-xl">
          <CardContent className="p-6">
            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="service">סוג ביקור</Label>
                <Select value={serviceId} onValueChange={setServiceId}>
                  <SelectTrigger id="service">
                    <SelectValue placeholder="בחר סוג ביקור" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} · {s.duration_minutes} דק׳
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedService?.description && (
                  <p className="text-xs text-muted-foreground">{selectedService.description}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="doctor">רופא</Label>
                <Select value={doctorId} onValueChange={setDoctorId}>
                  <SelectTrigger id="doctor">
                    <SelectValue placeholder="בחר רופא" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredDoctors.map((d) => {
                      const spec = doctorSpecialty(d);
                      return (
                        <SelectItem key={d.profile_id} value={d.profile_id}>
                          {doctorName(d)}
                          {spec ? ` · ${spec}` : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="datetime">תאריך ושעה</Label>
                <Input
                  id="datetime"
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  min={toLocalInput(new Date())}
                  required
                />
                {selectedService && (
                  <p className="text-xs text-muted-foreground">
                    משך התור: {selectedService.duration_minutes} דקות
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">הערות (אופציונלי)</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="פרט/י סיבת הביקור, סימפטומים וכו׳"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => navigate('/book')}>
                  ביטול
                </Button>
                <Button type="submit" disabled={submitting || !serviceId || !doctorId}>
                  {submitting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  קבע תור
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </>
  );
}
