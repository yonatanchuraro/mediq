import { useEffect, useState } from 'react';
import { Calendar, ListPlus, Stethoscope, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/layouts/AppShell';
import { useAuth } from '@/lib/auth/AuthProvider';

interface Stats {
  services: number;
  doctors: number;
  clients: number;
  appointments: number;
}

export default function AdminOverview() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [services, doctors, clients, appointments] = await Promise.all([
        supabase.from('services').select('*', { count: 'exact', head: true }).eq('active', true),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'doctor'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'client'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }),
      ]);
      if (!mounted) return;
      setStats({
        services: services.count ?? 0,
        doctors: doctors.count ?? 0,
        clients: clients.count ?? 0,
        appointments: appointments.count ?? 0,
      });
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const firstName = profile?.full_name?.split(' ')[0] ?? '';

  return (
    <>
      <PageHeader
        title={`שלום${firstName ? `, ${firstName}` : ''}`}
        description="תמונת מצב כללית של המרפאה"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="סוגי ביקור פעילים"
          value={stats?.services}
          loading={loading}
          icon={<ListPlus className="h-5 w-5" />}
          tint="primary"
        />
        <StatCard
          label="רופאים"
          value={stats?.doctors}
          loading={loading}
          icon={<Stethoscope className="h-5 w-5" />}
          tint="indigo"
        />
        <StatCard
          label="מטופלים רשומים"
          value={stats?.clients}
          loading={loading}
          icon={<Users className="h-5 w-5" />}
          tint="amber"
        />
        <StatCard
          label="סה״כ תורים"
          value={stats?.appointments}
          loading={loading}
          icon={<Calendar className="h-5 w-5" />}
          tint="emerald"
        />
      </div>

      <Card className="mt-6">
        <CardContent className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            הצעד הבא: צור סוגי ביקור ב-
            <a href="/admin/services" className="font-medium text-primary hover:underline">
              {' '}
              סוגי ביקור
            </a>{' '}
            ואז הזמן רופאים.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

type Tint = 'primary' | 'indigo' | 'amber' | 'emerald';

function StatCard({
  label,
  value,
  loading,
  icon,
  tint,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  icon: React.ReactNode;
  tint: Tint;
}) {
  const tintMap: Record<Tint, string> = {
    primary: 'bg-gradient-to-br from-primary to-teal-400 shadow-primary/30',
    indigo: 'bg-gradient-to-br from-indigo-500 to-violet-500 shadow-indigo-500/30',
    amber: 'bg-gradient-to-br from-amber-500 to-orange-400 shadow-amber-500/30',
    emerald: 'bg-gradient-to-br from-emerald-500 to-teal-500 shadow-emerald-500/30',
  };

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-md ${tintMap[tint]}`}
        >
          {icon}
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="text-2xl font-extrabold tabular-nums">
            {loading ? '—' : value ?? 0}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
