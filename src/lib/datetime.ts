import { format } from 'date-fns';
import { he } from 'date-fns/locale';

const TZ = { locale: he };

export function fmtDate(d: string | Date): string {
  return format(new Date(d), 'EEEE, d בMMMM yyyy', TZ);
}

export function fmtShortDate(d: string | Date): string {
  return format(new Date(d), 'd בMMMM', TZ);
}

export function fmtTime(d: string | Date): string {
  return format(new Date(d), 'HH:mm');
}

export function fmtDateTime(d: string | Date): string {
  return format(new Date(d), 'd בMMMM yyyy · HH:mm', TZ);
}

export function isPast(d: string | Date): boolean {
  return new Date(d).getTime() < Date.now();
}

/** Format a Date into the local "YYYY-MM-DDTHH:mm" string used by <input type="datetime-local"> */
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Round a Date up to the next 15-minute step */
export function roundToNextQuarter(d = new Date()): Date {
  const ms = 15 * 60_000;
  return new Date(Math.ceil(d.getTime() / ms) * ms);
}
