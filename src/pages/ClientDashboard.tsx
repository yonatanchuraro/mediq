import { Calendar, MessageSquare, User } from 'lucide-react';
import { AppShell, PlaceholderCard } from '@/components/layouts/AppShell';

export default function ClientDashboard() {
  return (
    <AppShell
      title="הזמנת תורים"
      subtitle="כל מה שאתה צריך כדי לקבוע תור"
      nav={[
        { to: '/book', label: 'התורים שלי', icon: <Calendar className="h-4 w-4" /> },
        { to: '/book/chat', label: 'צ׳אט AI', icon: <MessageSquare className="h-4 w-4" /> },
        { to: '/book/profile', label: 'פרופיל', icon: <User className="h-4 w-4" /> },
      ]}
    >
      <PlaceholderCard
        title="ברוך הבא"
        description="בשלב הבא נחבר כאן את צ׳אט ה-AI ואת לוח התורים שלך."
      />
    </AppShell>
  );
}
