import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/BrandMark';
import { useAuth } from '@/lib/auth/AuthProvider';
import { cn } from '@/lib/utils';

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

export function AppShell({
  subtitle,
  nav,
  children,
}: {
  subtitle?: string;
  nav: NavItem[];
  children?: ReactNode;
}) {
  const { profile, signOut } = useAuth();

  return (
    <div className="grid h-screen grid-cols-[240px_1fr] overflow-hidden bg-background">
      <aside className="flex h-screen flex-col border-l bg-card p-4">
        <div className="mb-6 flex items-center gap-3 border-b pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-teal-400 text-white shadow-md shadow-primary/30">
            <BrandMark className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-extrabold tracking-tight">MediQ</div>
            <div className="text-xs text-muted-foreground">{subtitle ?? 'ניהול תורים'}</div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 border-t pt-4">
          <div className="mb-2 px-3">
            <div className="text-sm font-medium text-foreground">
              {profile?.full_name ?? profile?.email}
            </div>
            <div className="text-xs text-muted-foreground">{profile?.email}</div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4" />
            התנתק
          </Button>
        </div>
      </aside>

      <main className="h-screen overflow-y-auto p-8">{children ?? <Outlet />}</main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </header>
  );
}
