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
      try {
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
      } catch (e) {
        console.error('[AdminOverview] stats failed:', e);
        if (mounted) setStats({ services: 0, doctors: 0, clients: 0, appointments: 0 });
      } finally {
        if (mounted) setLoading(false);
      }
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
  const tintMap: Record<Tint, { icon: string; glow: string; ring: string }> = {
    primary: {
      icon: 'from-primary to-teal-400',
      glow: 'shadow-primary/30',
      ring: 'from-primary/10 via-transparent',
    },
    indigo: {
      icon: 'from-indigo-500 to-violet-500',
      glow: 'shadow-indigo-500/30',
      ring: 'from-indigo-500/10 via-transparent',
    },
    amber: {
      icon: 'from-amber-500 to-orange-400',
      glow: 'shadow-amber-500/30',
      ring: 'from-amber-500/10 via-transparent',
    },
    emerald: {
      icon: 'from-emerald-500 to-teal-500',
      glow: 'shadow-emerald-500/30',
      ring: 'from-emerald-500/10 via-transparent',
    },
  };
  const t = tintMap[tint];

  return (
    <Card className="group relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg">
      {/* Subtle hover glow */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${t.ring} to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
      />
      <CardContent className="relative flex items-center gap-4 p-5">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${t.icon} text-white shadow-md ${t.glow} ring-1 ring-white/10`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="mt-0.5 text-3xl font-extrabold tabular-nums leading-tight tracking-tight">
            {loading ? <span className="text-muted-foreground/40">—</span> : value ?? 0}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
