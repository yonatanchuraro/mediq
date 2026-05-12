import { Calendar, MessageSquare, User } from 'lucide-react';
import { AppShell, PageHeader, type NavItem } from '@/components/layouts/AppShell';
import { Card, CardContent } from '@/components/ui/card';

const nav: NavItem[] = [
  { to: '/book', label: 'התורים שלי', icon: <Calendar className="h-4 w-4" />, end: true },
  { to: '/book/chat', label: 'צ׳אט AI', icon: <MessageSquare className="h-4 w-4" /> },
  { to: '/book/profile', label: 'פרופיל', icon: <User className="h-4 w-4" /> },
];

export default function ClientDashboard() {
  return (
    <AppShell subtitle="הזמנת תורים" nav={nav}>
      <PageHeader title="הזמנת תורים" description="כל מה שאתה צריך כדי לקבוע תור" />
      <Card>
        <CardContent className="p-12 text-center text-sm text-muted-foreground">
          הדשבורד של הלקוח (כולל צ׳אט AI) ייבנה בקרוב.
        </CardContent>
      </Card>
    </AppShell>
  );
}
