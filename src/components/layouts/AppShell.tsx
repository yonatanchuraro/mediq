import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
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

const SIDEBAR_KEY = 'mediq.sidebar.collapsed';

function getInitials(name?: string | null, email?: string | null): string {
  const source = (name?.trim() || email?.split('@')[0] || '?').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
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
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
    } catch {/* no-op */}
  }, [collapsed]);

  const initials = getInitials(profile?.full_name, profile?.email);

  return (
    <div
      className="relative grid h-screen overflow-hidden bg-background transition-[grid-template-columns] duration-300"
      style={{ gridTemplateColumns: `${collapsed ? '72px' : '240px'} 1fr` }}
    >
      {/* Collapse toggle — sits on top of the sidebar/content boundary.
          Rendered outside the <aside> because the sidebar uses overflow-hidden
          to clip its contents during the width transition. */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? 'הרחב סיידבר' : 'כווץ סיידבר'}
        title={collapsed ? 'הרחב' : 'כווץ'}
        className="absolute top-7 z-20 flex h-7 w-7 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-md transition-[right] duration-300 hover:bg-accent hover:text-foreground"
        style={{ right: `${(collapsed ? 72 : 240) - 14}px` }}
      >
        {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      <aside
        className={cn(
          'flex h-screen flex-col overflow-hidden border-l bg-card p-3 transition-all duration-300',
          collapsed ? 'items-center' : 'items-stretch p-4'
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            'mb-6 flex items-center border-b pb-4 transition-all',
            collapsed ? 'justify-center' : 'gap-3'
          )}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-teal-400 text-white shadow-md shadow-primary/30">
            <BrandMark className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <div className="text-base font-extrabold tracking-tight">MediQ</div>
              <div className="truncate text-xs text-muted-foreground">
                {subtitle ?? 'ניהול תורים'}
              </div>
            </div>
          )}
        </div>

        {/* Nav — uses min-h-0 so it can shrink instead of forcing the
            sidebar to overflow; scrollbar is suppressed visually since six
            nav items fit comfortably in any reasonable viewport. */}
        <nav
          className={cn(
            'flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto no-scrollbar',
            collapsed && 'w-full items-center'
          )}
        >
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center rounded-lg text-sm font-medium transition-all',
                  collapsed ? 'h-10 w-10 justify-center' : 'w-full gap-3 px-3 py-2',
                  isActive
                    ? 'bg-gradient-to-l from-primary/15 to-primary/5 text-primary shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute inset-y-1 right-0 w-1 rounded-full bg-gradient-to-b from-primary to-teal-400"
                    />
                  )}
                  <span className="shrink-0">{item.icon}</span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer / user */}
        <div className={cn('mt-4 border-t pt-4', collapsed && 'w-full')}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div
                title={profile?.full_name ?? profile?.email ?? ''}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-teal-400 text-xs font-bold text-white shadow-md shadow-primary/30"
              >
                {initials}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut()}
                title="התנתק"
                className="h-9 w-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-2 px-1">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-teal-400 text-xs font-bold text-white shadow-md shadow-primary/30">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {profile?.full_name ?? profile?.email}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {profile?.email}
                  </div>
                </div>
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
            </>
          )}
        </div>
      </aside>

      <main className="h-screen min-w-0 overflow-y-auto p-8">{children ?? <Outlet />}</main>
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
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </header>
  );
}
