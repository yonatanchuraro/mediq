import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fmtTime } from '@/lib/datetime';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 20;
const HOUR_HEIGHT = 60;
const SLOT_MIN = 30;
const WEEKDAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const WEEKDAYS_HE_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

export interface CalendarAppointment {
  id: string;
  start_at: string;
  end_at: string;
  title: string;
  subtitle?: string;
  status?: string;
}

export interface WorkingHourSimple {
  weekday: number;
  start_time: string | null;
  end_time: string | null;
  is_open: boolean;
}

interface Props {
  appointments: CalendarAppointment[];
  workingHours?: WorkingHourSimple[];
  onEventClick?: (id: string) => void;
  onSlotClick?: (date: Date) => void;
  initialAnchor?: Date;
  mode?: 'week' | 'day';
  hideToolbar?: boolean;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function AppointmentCalendar({
  appointments,
  workingHours,
  onEventClick,
  onSlotClick,
  initialAnchor,
  mode: initialMode = 'week',
  hideToolbar = false,
}: Props) {
  const [mode, setMode] = useState<'day' | 'week'>(initialMode);
  const [anchor, setAnchor] = useState<Date>(startOfDay(initialAnchor ?? new Date()));
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const days = useMemo(() => {
    if (mode === 'day') return [anchor];
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [mode, anchor]);

  const hours = useMemo(
    () => Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i),
    []
  );

  const today = startOfDay(new Date(nowTick));

  function shift(dir: -1 | 1) {
    setAnchor((d) => addDays(d, dir * (mode === 'day' ? 1 : 7)));
  }

  const monthLabel = useMemo(() => {
    if (mode === 'day') {
      return format(anchor, 'EEEE, d בMMMM yyyy', { locale: he });
    }
    const first = days[0];
    const last = days[days.length - 1];
    if (first.getMonth() === last.getMonth()) {
      return format(first, 'MMMM yyyy', { locale: he });
    }
    return `${format(first, 'MMMM', { locale: he })} – ${format(last, 'MMMM yyyy', { locale: he })}`;
  }, [mode, anchor, days]);

  const cols = days.length;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
      {!hideToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-1 rounded-lg bg-muted/60 p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => shift(-1)}
                className="h-7 w-7 p-0"
                title="הקודם"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAnchor(startOfDay(new Date()))}
                className="h-7 px-3 text-xs font-semibold"
              >
                היום
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => shift(1)}
                className="h-7 w-7 p-0"
                title="הבא"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-base font-semibold tracking-tight">{monthLabel}</div>
          </div>

          <div className="inline-flex items-center gap-1 rounded-lg bg-muted/60 p-1">
            <Button
              variant={mode === 'day' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMode('day')}
              className={cn('h-7 px-3 text-xs', mode === 'day' && 'shadow-sm')}
            >
              יום
            </Button>
            <Button
              variant={mode === 'week' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMode('week')}
              className={cn('h-7 px-3 text-xs', mode === 'week' && 'shadow-sm')}
            >
              שבוע
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <div
          className="grid"
          style={{ gridTemplateColumns: `64px repeat(${cols}, minmax(120px, 1fr))` }}
        >
          {/* Corner */}
          <div className="sticky top-0 z-20 border-b border-l bg-muted/30 backdrop-blur-sm" />

          {/* Day headers */}
          {days.map((d) => {
            const isToday = d.getTime() === today.getTime();
            const wh = workingHours?.find((w) => w.weekday === d.getDay());
            const isClosed = wh && !wh.is_open;
            return (
              <div
                key={d.toISOString()}
                className={cn(
                  'sticky top-0 z-10 flex flex-col items-center gap-0.5 border-b border-l p-3 transition',
                  isToday
                    ? 'bg-gradient-to-b from-primary/10 to-transparent'
                    : 'bg-muted/30 backdrop-blur-sm',
                  isClosed && 'opacity-60'
                )}
              >
                <div
                  className={cn(
                    'text-[11px] font-semibold uppercase tracking-wider',
                    isToday ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  {mode === 'day' ? WEEKDAYS_HE[d.getDay()] : WEEKDAYS_HE_SHORT[d.getDay()]}
                </div>
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold tabular-nums transition',
                    isToday
                      ? 'bg-gradient-to-br from-primary to-teal-400 text-white shadow-md shadow-primary/30'
                      : 'text-foreground'
                  )}
                >
                  {d.getDate()}
                </div>
                {isClosed && (
                  <div className="text-[10px] font-medium text-muted-foreground/80">סגור</div>
                )}
              </div>
            );
          })}

          {/* Hours column */}
          <div className="sticky right-0 z-10 border-l bg-muted/20 backdrop-blur-sm">
            {hours.map((h) => (
              <div
                key={h}
                className="relative flex justify-end px-2 pt-1 text-[10px] font-semibold tabular-nums text-muted-foreground/70"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="-mt-1 bg-card px-1">{String(h).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((d) => (
            <DayColumn
              key={d.toISOString()}
              day={d}
              hours={hours}
              isToday={d.getTime() === today.getTime()}
              nowTick={nowTick}
              workingHours={workingHours?.find((w) => w.weekday === d.getDay())}
              appointments={appointments.filter(
                (a) => startOfDay(new Date(a.start_at)).getTime() === d.getTime()
              )}
              onSlotClick={onSlotClick}
              onEventClick={onEventClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayColumn({
  day,
  hours,
  isToday,
  nowTick,
  workingHours,
  appointments,
  onSlotClick,
  onEventClick,
}: {
  day: Date;
  hours: number[];
  isToday: boolean;
  nowTick: number;
  workingHours?: WorkingHourSimple;
  appointments: CalendarAppointment[];
  onSlotClick?: (d: Date) => void;
  onEventClick?: (id: string) => void;
}) {
  const colStartMin = DAY_START_HOUR * 60;

  let nowTop: number | null = null;
  let nowLabel = '';
  if (isToday) {
    const now = new Date(nowTick);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin >= colStartMin && nowMin <= DAY_END_HOUR * 60) {
      nowTop = ((nowMin - colStartMin) / 60) * HOUR_HEIGHT;
      nowLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
  }

  let workStartMin: number | null = null;
  let workEndMin: number | null = null;
  if (workingHours && workingHours.is_open && workingHours.start_time && workingHours.end_time) {
    const [sh, sm] = workingHours.start_time.split(':').map(Number);
    const [eh, em] = workingHours.end_time.split(':').map(Number);
    workStartMin = sh * 60 + sm;
    workEndMin = eh * 60 + em;
  }

  return (
    <div
      className={cn(
        'relative border-l',
        isToday && 'bg-gradient-to-b from-primary/[0.02] to-transparent'
      )}
      style={{ height: hours.length * HOUR_HEIGHT }}
    >
      {/* working hours band */}
      {workStartMin != null && workEndMin != null && (
        <div
          className="absolute inset-x-0 bg-gradient-to-l from-emerald-50/60 to-emerald-50/30 dark:from-emerald-900/10 dark:to-emerald-900/5"
          style={{
            top: ((workStartMin - colStartMin) / 60) * HOUR_HEIGHT,
            height: ((workEndMin - workStartMin) / 60) * HOUR_HEIGHT,
          }}
        />
      )}

      {/* hour lines */}
      {hours.map((h, i) =>
        i > 0 ? (
          <div
            key={h}
            className="pointer-events-none absolute inset-x-0 border-t border-border/40"
            style={{ top: i * HOUR_HEIGHT }}
          />
        ) : null
      )}

      {/* 30-min slots — clickable */}
      {onSlotClick &&
        hours.flatMap((h) =>
          [0, SLOT_MIN].map((m) => {
            const d = new Date(day);
            d.setHours(h, m, 0, 0);
            return (
              <button
                key={`${h}-${m}`}
                type="button"
                className="absolute inset-x-0 cursor-pointer transition hover:bg-primary/[0.06]"
                style={{
                  top: ((h - DAY_START_HOUR) * 60 + m) * (HOUR_HEIGHT / 60),
                  height: HOUR_HEIGHT / 2,
                }}
                onClick={() => onSlotClick(d)}
              />
            );
          })
        )}

      {/* now line */}
      {nowTop != null && (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
          style={{ top: nowTop }}
        >
          <div
            className="flex h-5 items-center rounded-md bg-rose-500 px-1.5 text-[10px] font-bold text-white shadow-md"
            style={{ position: 'absolute', insetInlineEnd: '-2px', transform: 'translateY(-50%)' }}
          >
            {nowLabel}
          </div>
          <div className="h-0.5 w-full bg-gradient-to-l from-rose-500 via-rose-500 to-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
        </div>
      )}

      {/* events */}
      {appointments.map((a) => {
        const start = new Date(a.start_at);
        const end = new Date(a.end_at);
        const minTop = start.getHours() * 60 + start.getMinutes() - colStartMin;
        const heightMin = Math.max(25, (end.getTime() - start.getTime()) / 60_000);
        if (minTop < 0 || minTop > (DAY_END_HOUR - DAY_START_HOUR) * 60) return null;

        const heightPx = (heightMin / 60) * HOUR_HEIGHT - 4;
        const compact = heightPx < 50;

        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onEventClick?.(a.id)}
            className={cn(
              'group absolute z-[2] flex flex-col items-stretch overflow-hidden rounded-lg text-right text-white shadow-md transition-all',
              'hover:-translate-y-0.5 hover:shadow-lg hover:ring-2 hover:ring-white/30',
              statusColor(a.status)
            )}
            style={{
              top: (minTop / 60) * HOUR_HEIGHT + 2,
              height: heightPx,
              insetInlineStart: 4,
              insetInlineEnd: 4,
            }}
            title={`${a.title} · ${fmtTime(start)}–${fmtTime(end)}${a.subtitle ? ` · ${a.subtitle}` : ''}`}
          >
            {/* Inner top highlight for glassy depth */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent"
            />
            {/* Accent bar on inside edge */}
            <div
              aria-hidden
              className="absolute inset-y-1 w-1 rounded-full bg-white/50"
              style={{ insetInlineStart: 3 }}
            />

            <div className={cn('relative flex flex-col gap-0.5 px-3 py-1.5', compact && 'py-1 gap-0')}>
              <div className="flex items-center justify-between gap-1 text-[10px] font-bold tabular-nums leading-none opacity-90">
                <span>{fmtTime(start)} · {fmtTime(end)}</span>
                {a.status && !compact && (
                  <span className="rounded-sm bg-white/15 px-1 py-px text-[9px] font-semibold uppercase tracking-wider">
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                )}
              </div>
              <div className={cn('truncate font-bold leading-tight', compact ? 'text-xs' : 'text-[13px]')}>
                {a.title}
              </div>
              {a.subtitle && !compact && (
                <div className="truncate text-[10px] opacity-85">{a.subtitle}</div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'ממתין',
  confirmed: 'מאושר',
  cancelled: 'בוטל',
  completed: 'הושלם',
  no_show: 'לא הגיע',
};

function statusColor(status?: string): string {
  switch (status) {
    case 'cancelled':
      return 'bg-gradient-to-br from-slate-400 to-slate-500 opacity-70';
    case 'completed':
      return 'bg-gradient-to-br from-blue-500 to-indigo-600';
    case 'no_show':
      return 'bg-gradient-to-br from-rose-500 to-rose-600';
    case 'confirmed':
      return 'bg-gradient-to-br from-emerald-500 via-emerald-500 to-teal-500';
    case 'pending':
    default:
      return 'bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-500';
  }
}
