import { Calendar, LayoutDashboard, Layers, ListPlus, Settings, Stethoscope } from 'lucide-react';
import { AppShell, type NavItem } from '@/components/layouts/AppShell';

const nav: NavItem[] = [
  { to: '/admin', label: 'סקירה', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
  { to: '/admin/specialties', label: 'מחלקות', icon: <Layers className="h-4 w-4" /> },
  { to: '/admin/services', label: 'סוגי ביקור', icon: <ListPlus className="h-4 w-4" /> },
  { to: '/admin/doctors', label: 'רופאים', icon: <Stethoscope className="h-4 w-4" /> },
  { to: '/admin/appointments', label: 'תורים', icon: <Calendar className="h-4 w-4" /> },
  { to: '/admin/settings', label: 'הגדרות', icon: <Settings className="h-4 w-4" /> },
];

export default function AdminLayout() {
  return <AppShell subtitle="לוח בקרה — אדמין" nav={nav} />;
}
