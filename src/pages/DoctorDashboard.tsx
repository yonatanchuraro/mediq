import { Calendar, Clock, User } from 'lucide-react';
import { AppShell, PlaceholderCard } from '@/components/layouts/AppShell';

export default function DoctorDashboard() {
  return (
    <AppShell
      title="היומן שלי"
      subtitle="ניהול תורים אישי"
      nav={[
        { to: '/doctor', label: 'היומן', icon: <Calendar className="h-4 w-4" /> },
        { to: '/doctor/hours', label: 'שעות עבודה', icon: <Clock className="h-4 w-4" /> },
        { to: '/doctor/profile', label: 'פרופיל', icon: <User className="h-4 w-4" /> },
      ]}
    >
      <PlaceholderCard
        title="היומן שלך"
        description="כאן יוצגו התורים שלך, אפשרות לעדכן שעות עבודה ולנהל את הזמינות."
      />
    </AppShell>
  );
}
