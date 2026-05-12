import { Calendar, Stethoscope, Settings, Users } from 'lucide-react';
import { AppShell, PlaceholderCard } from '@/components/layouts/AppShell';

export default function AdminDashboard() {
  return (
    <AppShell
      title="לוח בקרה — אדמין"
      subtitle="ניהול המרפאה"
      nav={[
        { to: '/admin', label: 'סקירה', icon: <Calendar className="h-4 w-4" /> },
        { to: '/admin/doctors', label: 'רופאים', icon: <Stethoscope className="h-4 w-4" /> },
        { to: '/admin/clients', label: 'מטופלים', icon: <Users className="h-4 w-4" /> },
        { to: '/admin/settings', label: 'הגדרות', icon: <Settings className="h-4 w-4" /> },
      ]}
    >
      <PlaceholderCard
        title="ברוך הבא לדשבורד האדמין"
        description="כאן נוסיף בשלב הבא: ניהול רופאים, סוגי ביקור, צפייה בכל התורים."
      />
    </AppShell>
  );
}
