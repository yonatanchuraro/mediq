import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fmtShortDate, fmtTime } from '@/lib/datetime';

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 20;
const HOUR_HEIGHT = 56;
const SLOT_MIN = 30;
const WEEKDAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

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

  const title =
    mode === 'day'
      ? `${WEEKDAYS_HE[anchor.getDay()]}, ${fmtShortDate(anchor)}`
      : `${fmtShortDate(days[0])} – ${fmtShortDate(days[days.length - 1])}`;

  const cols = days.length;

  return (
    <div className="flex h-full flex-col rounded-xl border bg-card">
      {!hideToolbar && (
        <div className="flex items-center justify-between gap-3 border-b p-3">
          <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
            <Button variant="ghost" size="sm" onClick={() => shift(-1)} className="h-7 px-2">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAnchor(startOfDay(new Date()))}
              className="h-7 px-3"
            >
              היום
            </Button>
            <Button variant="ghost" size="sm" onClick={() => shift(1)} className="h-7 px-2">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          <div className="text-base font-semibold tracking-tight">{title}</div>

          <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
            <Button
              variant={mode === 'day' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMode('day')}
              className="h-7 px-3"
            >
              יום
            </Button>
            <Button
              variant={mode === 'week' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMode('week')}
              className="h-7 px-3"
            >
              שבוע
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <div
          className="grid"
          style={{ gridTemplateColumns: `56px repeat(${cols}, minmax(120px, 1fr))` }}
        >
          {/* Corner */}
          <div className="sticky top-0 z-20 border-b border-l bg-muted/50" />

          {/* Day headers */}
          {days.map((d) => {
            const isToday = d.getTime() === today.getTime();
            const wh = workingHours?.find((w) => w.weekday === d.getDay());
            const isClosed = wh && !wh.is_open;
            return (
              <div
                key={d.toISOString()}
                className={cn(
                  'sticky top-0 z-10 border-b border-l p-2 text-center text-xs',
                  isToday ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground',
                  isClosed && 'opacity-60'
                )}
              >
                <div className="font-semibold">{WEEKDAYS_HE[d.getDay()]}</div>
                <div>{fmtShortDate(d)}</div>
                {isToday && (
                  <div className="mt-1 inline-flex rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                    היום
                  </div>
                )}
              </div>
            );
          })}

          {/* Hours column */}
          <div className="sticky right-0 z-10 border-l bg-muted/30">
            {hours.map((h) => (
              <div
                key={h}
                className="flex justify-end px-2 pt-1 text-[10px] font-medium text-muted-foreground"
                style={{ height: HOUR_HEIGHT }}
              >
                {String(h).padStart(2, '0')}:00
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
  if (isToday) {
    const now = new Date(nowTick);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin >= colStartMin && nowMin <= DAY_END_HOUR * 60) {
      nowTop = ((nowMin - colStartMin) / 60) * HOUR_HEIGHT;
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
        isToday && 'bg-primary/[0.02]'
      )}
      style={{ height: hours.length * HOUR_HEIGHT }}
    >
      {/* working hours band */}
      {workStartMin != null && workEndMin != null && (
        <div
          className="absolute inset-x-0 bg-emerald-50/80 dark:bg-emerald-900/10"
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
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border/60"
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
                className="absolute inset-x-0 cursor-pointer transition hover:bg-primary/10"
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
          <div className="h-0.5 w-full bg-red-500" />
          <div className="absolute -right-1 h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.2)]" />
        </div>
      )}

      {/* events */}
      {appointments.map((a) => {
        const start = new Date(a.start_at);
        const end = new Date(a.end_at);
        const minTop = start.getHours() * 60 + start.getMinutes() - colStartMin;
        const heightMin = Math.max(20, (end.getTime() - start.getTime()) / 60_000);
        if (minTop < 0 || minTop > (DAY_END_HOUR - DAY_START_HOUR) * 60) return null;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onEventClick?.(a.id)}
            className={cn(
              'absolute z-[2] flex flex-col items-stretch justify-start gap-0.5 overflow-hidden rounded-md px-2 py-1 text-right text-xs text-white shadow transition hover:translate-y-[-1px] hover:shadow-md',
              statusColor(a.status)
            )}
            style={{
              top: (minTop / 60) * HOUR_HEIGHT + 2,
              height: (heightMin / 60) * HOUR_HEIGHT - 4,
              insetInlineStart: 4,
              insetInlineEnd: 4,
            }}
            title={`${a.title} · ${fmtTime(start)}–${fmtTime(end)}`}
          >
            <div className="text-[10px] font-semibold opacity-90 leading-none">
              {fmtTime(start)} · {fmtTime(end)}
            </div>
            <div className="truncate font-semibold leading-tight">{a.title}</div>
            {a.subtitle && (
              <div className="truncate text-[10px] opacity-90">{a.subtitle}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function statusColor(status?: string): string {
  switch (status) {
    case 'cancelled':
      return 'bg-gradient-to-br from-slate-400 to-slate-500 opacity-70';
    case 'completed':
      return 'bg-gradient-to-br from-blue-500 to-blue-600';
    case 'no_show':
      return 'bg-gradient-to-br from-rose-500 to-rose-600';
    case 'confirmed':
      return 'bg-gradient-to-br from-emerald-500 to-teal-500';
    case 'pending':
    default:
      return 'bg-gradient-to-br from-indigo-500 to-violet-500';
  }
}
