import { Calendar, MessageSquare, Plus } from 'lucide-react';
import { AppShell, type NavItem } from '@/components/layouts/AppShell';

const nav: NavItem[] = [
  { to: '/book', label: 'התורים שלי', icon: <Calendar className="h-4 w-4" />, end: true },
  { to: '/book/new', label: 'קבע תור', icon: <Plus className="h-4 w-4" /> },
  { to: '/book/chat', label: 'צ׳אט AI', icon: <MessageSquare className="h-4 w-4" /> },
];

export default function BookLayout() {
  return <AppShell subtitle="הזמנת תורים" nav={nav} />;
}
