import { Calendar, Clock, User } from 'lucide-react';
import { AppShell, type NavItem } from '@/components/layouts/AppShell';

const nav: NavItem[] = [
  { to: '/doctor', label: 'היומן', icon: <Calendar className="h-4 w-4" />, end: true },
  { to: '/doctor/hours', label: 'שעות עבודה', icon: <Clock className="h-4 w-4" /> },
  { to: '/doctor/profile', label: 'פרופיל', icon: <User className="h-4 w-4" /> },
];

export default function DoctorLayout() {
  return <AppShell subtitle="ניהול תורים אישי" nav={nav} />;
}
