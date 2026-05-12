import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/BrandMark';
import { useAuth } from '@/lib/auth/AuthProvider';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

export function AppShell({
  title,
  subtitle,
  nav,
  children,
}: {
  title: string;
  subtitle?: string;
  nav: NavItem[];
  children: ReactNode;
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
              end
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
          <div className="mb-2 px-3 text-xs text-muted-foreground">
            {profile?.full_name ?? profile?.email}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4" />
            התנתק
          </Button>
        </div>
      </aside>

      <main className="h-screen overflow-y-auto p-8">
        <header className="mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </header>
        {children}
      </main>
    </div>
  );
}

export function PlaceholderCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <BrandMark className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <p className="mt-4 text-xs text-muted-foreground">
        בקרוב — בשלב הבא של הפיתוח. ראה <Link to="/" className="text-primary underline">בית</Link>.
      </p>
    </div>
  );
}
