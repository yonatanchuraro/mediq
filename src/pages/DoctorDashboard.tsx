import { Calendar, Clock, User } from 'lucide-react';
import { AppShell, PageHeader, type NavItem } from '@/components/layouts/AppShell';
import { Card, CardContent } from '@/components/ui/card';

const nav: NavItem[] = [
  { to: '/doctor', label: 'היומן', icon: <Calendar className="h-4 w-4" />, end: true },
  { to: '/doctor/hours', label: 'שעות עבודה', icon: <Clock className="h-4 w-4" /> },
  { to: '/doctor/profile', label: 'פרופיל', icon: <User className="h-4 w-4" /> },
];

export default function DoctorDashboard() {
  return (
    <AppShell subtitle="ניהול תורים אישי" nav={nav}>
      <PageHeader title="היומן שלי" description="התורים שלך, שעות העבודה והפרופיל" />
      <Card>
        <CardContent className="p-12 text-center text-sm text-muted-foreground">
          הדשבורד של הרופא ייבנה בקרוב.
        </CardContent>
      </Card>
    </AppShell>
  );
}
