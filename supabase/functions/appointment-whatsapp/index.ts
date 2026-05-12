// MediQ — Appointment WhatsApp notifications (Supabase Edge Function, Deno)
//
// Three modes:
//   1. {type: "confirmation", appointment_id}   — fire when appointment is booked
//   2. {type: "cancellation", appointment_id}   — fire when an appointment is cancelled
//   3. {type: "reminder_24h",  appointment_id}  — fire 24h before start_at (manual)
//   4. {type: "batch_reminder_24h"}             — called by pg_cron every hour;
//                                                  scans appointments 23-25h out
//                                                  and sends reminders to anyone
//                                                  not yet reminded.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_WHATSAPP_FROM   e.g. "whatsapp:+14155238886" (Twilio sandbox)
//   CRON_SECRET            arbitrary long random string; must match the
//                          DB setting app.cron_secret used by pg_cron.
//
// Auto-injected: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
//
// All DB access here uses service_role since the function is called from
// fire-and-forget client code AND from pg_cron — RLS doesn't apply, but we
// gate the batch path behind CRON_SECRET so it's not a public endpoint.

// deno-lint-ignore-file no-explicit-any

import { createClient } from 'jsr:@supabase/supabase-js@2';

const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const TWILIO_FROM = Deno.env.get('TWILIO_WHATSAPP_FROM');
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type NotificationType =
  | 'confirmation'
  | 'cancellation'
  | 'reminder_24h'
  | 'batch_reminder_24h';

interface RequestBody {
  appointment_id?: string;
  type?: NotificationType;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function normalizeIsraelPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) return `972${digits.slice(1)}`;
  if (digits.startsWith('972')) return digits;
  return digits;
}

function fmtIsrael(iso: string): { date: string; time: string; weekday: string } {
  const dt = new Date(iso);
  const date = new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Jerusalem',
  }).format(dt);
  const time = new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jerusalem',
  }).format(dt);
  const weekday = new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    timeZone: 'Asia/Jerusalem',
  }).format(dt);
  return { date, time, weekday };
}

function formatMessage(
  a: any,
  type: 'confirmation' | 'cancellation' | 'reminder_24h'
): string {
  const { date, time, weekday } = fmtIsrael(a.start_at);
  const doctorName =
    a.doctor?.profile?.full_name?.trim() ||
    (Array.isArray(a.doctor?.profile) ? a.doctor.profile[0]?.full_name?.trim() : null) ||
    'הרופא';
  const service = a.service?.name?.trim() || 'התור';
  const name = a.client?.full_name?.trim() || '';
  const greet = name ? `שלום ${name}` : 'שלום';

  switch (type) {
    case 'confirmation':
      return [
        `${greet} 👋`,
        '',
        `התור שלך אצל ${doctorName} ל${service} נקבע בהצלחה:`,
        `📅 יום ${weekday}, ${date}`,
        `⏰ בשעה ${time}`,
        '',
        'נשלח לך תזכורת יום לפני התור.',
        'לביטול: השב "ביטול".',
        '— MediQ',
      ].join('\n');
    case 'reminder_24h':
      return [
        `${greet} 👋`,
        '',
        `תזכורת: יש לך תור מחר (${weekday}, ${date}) בשעה ${time}`,
        `אצל ${doctorName} ל${service}.`,
        '',
        'נשמח לראותך! לביטול השב "ביטול".',
        '— MediQ',
      ].join('\n');
    case 'cancellation':
      return [
        `${greet} 👋`,
        '',
        `התור שלך ל${service} ב-${date} בשעה ${time} בוטל.`,
        '',
        'לקביעת תור חדש היכנס לאתר MediQ.',
        '— MediQ',
      ].join('\n');
  }
}

async function sendTwilioWhatsApp(
  to: string,
  body: string
): Promise<{ ok: boolean; error?: string }> {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    return { ok: false, error: 'Twilio secrets not configured' };
  }
  const resp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
      },
      body: new URLSearchParams({
        From: TWILIO_FROM,
        To: to,
        Body: body.slice(0, 1400),
      }),
    }
  );
  if (!resp.ok) {
    const text = await resp.text();
    console.error('[twilio] non-2xx', resp.status, text);
    return { ok: false, error: `Twilio ${resp.status}: ${text.slice(0, 200)}` };
  }
  return { ok: true };
}

async function sendOne(
  admin: ReturnType<typeof createClient>,
  appointmentId: string,
  type: 'confirmation' | 'cancellation' | 'reminder_24h'
): Promise<{ ok: boolean; error?: string; skipped?: string }> {
  const { data: a, error } = await admin
    .from('appointments')
    .select(
      `id, start_at, end_at, status, whatsapp_sent,
       service:services!service_id(name),
       doctor:doctors!doctor_id(profile:profiles!profile_id(full_name)),
       client:profiles!client_id(full_name, phone)`
    )
    .eq('id', appointmentId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!a) return { ok: false, error: 'appointment not found' };

  const sent = (a as any).whatsapp_sent ?? {};
  if (sent[type]) return { ok: true, skipped: 'already sent' };

  const clientPhone = Array.isArray((a as any).client)
    ? (a as any).client[0]?.phone
    : (a as any).client?.phone;
  const phone = normalizeIsraelPhone(clientPhone);
  if (!phone) return { ok: false, error: 'client has no phone' };

  const msg = formatMessage(a, type);
  const sendResult = await sendTwilioWhatsApp(`whatsapp:+${phone}`, msg);
  if (!sendResult.ok) return sendResult;

  const newSent = { ...sent, [type]: new Date().toISOString() };
  await admin.from('appointments').update({ whatsapp_sent: newSent }).eq('id', appointmentId);
  return { ok: true };
}

// ── Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405);

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = ((await req.json().catch(() => ({}))) || {}) as RequestBody;

    // ── Batch mode ───────────────────────────────────────────────────
    if (body.type === 'batch_reminder_24h') {
      const auth = req.headers.get('Authorization') ?? '';
      if (!CRON_SECRET || !auth.includes(CRON_SECRET)) {
        return jsonResponse({ error: 'unauthorized' }, 401);
      }
      const now = Date.now();
      const from = new Date(now + 23 * 3_600_000).toISOString();
      const to = new Date(now + 25 * 3_600_000).toISOString();
      const { data: rows, error } = await admin
        .from('appointments')
        .select('id, whatsapp_sent, status')
        .gte('start_at', from)
        .lte('start_at', to)
        .in('status', ['pending', 'confirmed']);
      if (error) return jsonResponse({ error: error.message }, 500);

      const candidates = (rows ?? []).filter(
        (r: any) => !(r.whatsapp_sent ?? {}).reminder_24h
      );

      const results = await Promise.all(
        candidates.map((r: any) => sendOne(admin, r.id, 'reminder_24h'))
      );
      return jsonResponse({
        ok: true,
        scanned: rows?.length ?? 0,
        attempted: candidates.length,
        sent: results.filter((r) => r.ok && !r.skipped).length,
        errors: results.filter((r) => !r.ok).map((r) => r.error),
      });
    }

    // ── Single mode ──────────────────────────────────────────────────
    if (!body.appointment_id) {
      return jsonResponse({ error: 'appointment_id is required' }, 400);
    }
    if (
      body.type !== 'confirmation' &&
      body.type !== 'cancellation' &&
      body.type !== 'reminder_24h'
    ) {
      return jsonResponse({ error: 'invalid type' }, 400);
    }

    const result = await sendOne(admin, body.appointment_id, body.type);
    return jsonResponse(result, result.ok ? 200 : 500);
  } catch (e) {
    console.error('[appointment-whatsapp] fatal', e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
