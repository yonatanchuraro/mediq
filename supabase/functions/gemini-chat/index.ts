// MediQ — Gemini booking chat (Supabase Edge Function, Deno runtime)
//
// Receives chat messages from the client, talks to Gemini with function-calling
// (list_services / list_doctors / check_availability / book_appointment),
// executes the called tools against Supabase (as the authenticated user, so RLS
// applies), and returns the model's final reply.
//
// Secrets expected in the Supabase project (set via Dashboard → Edge Functions
// → Secrets, OR `supabase secrets set ...`):
//   GEMINI_API_KEY        — Google AI Studio key
//
// Auto-injected by Supabase runtime (no need to set manually):
//   SUPABASE_URL
//   SUPABASE_ANON_KEY

// deno-lint-ignore-file no-explicit-any

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
const MAX_TOOL_ROUNDS = 4;          // was 6 — most flows finish in 2-3
const HISTORY_LIMIT = 12;            // tail-truncate to keep prompts small
const CACHE_TTL_MS = 60_000;         // 60s for services / doctors / specialties

// Module-level cache shared across invocations within the same Function
// instance — Edge Functions stay warm for a few minutes so this saves
// repeat round-trips to Postgres for data that barely changes.
type CacheEntry = { data: unknown; at: number };
const cache = new Map<string, CacheEntry>();

async function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data as T;
  const data = await loader();
  cache.set(key, { data, at: Date.now() });
  return data;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function buildSystemPrompt(): string {
  // Israel local time (UTC+2/+3 depending on DST). Use Intl for correctness.
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', ...opts }).format(new Date());
  const today = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }); // YYYY-MM-DD
  const time = fmt({ hour: '2-digit', minute: '2-digit', hour12: false });
  const weekday = HEBREW_DAYS[
    new Date(today + 'T12:00:00+02:00').getDay()
  ];
  return `אתה עוזר MediQ — תפקידך לקבוע תורים. דבר עברית, קצר ומדויק, בלי מילים מיותרות.

מידע נוכחי:
- היום: יום ${weekday}, ${today}, שעה ${time} (שעון ישראל).
- "מחר" / "השבוע" / "ביום X" — חושב לפי התאריך הזה.

חוקי זהב — אסור לשבור אותם:
1. **בצע, אל תבקש אישור לבצע.** אם חסר לך מידע, קרא לכלי מיידית — אל תשאל "האם תרצי שאבדוק?". זו ההנחה.
2. **לעולם אל תזכיר טרמינולוגיה טכנית** למשתמש: אסור "ID", "service_id", "doctor_id", "אני בודקת בDB", "מצאתי את ה-ID הנכון".
3. **אסור להתנצל על שגיאות פנימיות.** אם כלי החזיר שגיאה — נסה שוב בשקט עם פרמטרים אחרים, בלי לומר "אופס" או "הייתה שגיאה טכנית". מבחינת המשתמש: כל מה שראה הוא תשובה אחת מועילה.
4. **תזכור הקשר תמיד.** ברגע שמצאת service_id או doctor_id, השתמש בהם שוב. אל תקרא ל-list_services פעמיים באותה שיחה.

זרימת עבודה אופטימלית:
A. המשתמש מתאר צורך → קרא ברצף: list_services → list_doctors(service_id) → check_availability עבור 1-3 ימים פנויים.
B. הצג בתשובה אחת: "מצאתי את [שם הרופא]. זמנים פנויים: [3 זמנים]. איזה מתאים לך?"
C. המשתמש בחר זמן → קרא מיידית ל-book_appointment עם start_at בפורמט ISO 8601+timezone (כמו "2026-05-15T10:00:00+03:00").
D. אישור קצר: "התור נקבע: יום X ב-HH:MM אצל [שם הרופא] ל[סוג ביקור]".

כללי שיחה:
- שם רופא: השתמש ב-name המדויק מ-list_doctors (למשל "ד״ר רחל אברהם"). אם name חזר null — "הרופאה" + ההתמחות. אל תמציא שם.
- כשהמשתמש שואל "מי יש?" — אל תאמר "אני בודקת". קרא ל-list_doctors ותענה ישירות עם הרשימה.
- העדף תאריכים ב-14 הימים הקרובים. אם המשתמש לא ציין יום — תבחר את המוקדם ביותר.
- אם המשתמש מבטא דחיפות רפואית אמיתית, הצע פנייה למוקד/מיון.`;
}

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'list_services',
        description: 'מחזיר רשימה של סוגי ביקור פעילים במרפאה',
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'list_doctors',
        description: 'מחזיר רשימה של רופאים פעילים. אופציונלי לסנן לפי service_id',
        parameters: {
          type: 'object',
          properties: {
            service_id: { type: 'string', description: 'אם נתון — להחזיר רק רופאים שמציעים שירות זה' },
          },
        },
      },
      {
        name: 'check_availability',
        description:
          'מחזיר זמנים פנויים אצל רופא ביום נתון (תאריך בלבד, ISO YYYY-MM-DD), על בסיס שעות העבודה של הרופא והתורים הקיימים',
        parameters: {
          type: 'object',
          properties: {
            doctor_id: { type: 'string' },
            service_id: { type: 'string' },
            date: { type: 'string', description: 'YYYY-MM-DD' },
          },
          required: ['doctor_id', 'service_id', 'date'],
        },
      },
      {
        name: 'book_appointment',
        description:
          'יוצר תור חדש עבור המשתמש המחובר. חובה לאשר עם המשתמש לפני קריאה לכלי זה',
        parameters: {
          type: 'object',
          properties: {
            doctor_id: { type: 'string' },
            service_id: { type: 'string' },
            start_at: { type: 'string', description: 'ISO 8601 datetime עם timezone' },
            notes: { type: 'string', description: 'סיבת הביקור או הערות (אופציונלי)' },
          },
          required: ['doctor_id', 'service_id', 'start_at'],
        },
      },
    ],
  },
];

// ── tool implementations ────────────────────────────────────────────────────

function makeTools(sb: ReturnType<typeof createClient>, userId: string) {
  return {
    async list_services(): Promise<unknown> {
      return await cached('services', async () => {
        const { data, error } = await sb
          .from('services')
          .select('id, name, description, duration_minutes, price_cents, specialty_id')
          .eq('active', true)
          .order('name');
        if (error) return { error: error.message };
        return { services: data };
      });
    },

    async list_doctors({ service_id }: { service_id?: string }): Promise<unknown> {
      // All doctors are cached together; the service filter is applied
      // in-memory using the cached doctor_services map.
      const allDoctors = await cached('doctors', async () => {
        const { data, error } = await sb
          .from('doctors')
          .select(
            'profile_id, bio, profile:profiles!profile_id(full_name), specialty:specialties!specialty_id(name)'
          )
          .eq('active', true);
        if (error) throw error;
        return data ?? [];
      });

      let filtered = allDoctors as any[];
      if (service_id) {
        const dsRows = await cached('doctor_services', async () => {
          const { data, error } = await sb
            .from('doctor_services')
            .select('doctor_id, service_id');
          if (error) throw error;
          return data ?? [];
        });
        const allowed = new Set(
          (dsRows as any[])
            .filter((r) => r.service_id === service_id)
            .map((r) => r.doctor_id)
        );
        if (allowed.size > 0) filtered = filtered.filter((d) => allowed.has(d.profile_id));
      }

      const extractField = (val: any, field: string): string | null => {
        if (!val) return null;
        if (Array.isArray(val)) return val[0]?.[field]?.trim() || null;
        return val[field]?.trim() || null;
      };

      return {
        doctors: filtered.map((d: any) => ({
          id: d.profile_id,
          name: extractField(d.profile, 'full_name'),
          specialty: extractField(d.specialty, 'name'),
          bio: d.bio,
        })),
      };
    },

    async check_availability({
      doctor_id,
      service_id,
      date,
    }: {
      doctor_id: string;
      service_id: string;
      date: string; // YYYY-MM-DD
    }): Promise<unknown> {
      const [{ data: svc, error: svcErr }, { data: hours, error: hErr }] = await Promise.all([
        sb.from('services').select('duration_minutes').eq('id', service_id).maybeSingle(),
        sb
          .from('working_hours')
          .select('weekday, start_time, end_time, is_open')
          .eq('doctor_id', doctor_id),
      ]);
      if (svcErr) return { error: svcErr.message };
      if (hErr) return { error: hErr.message };
      if (!svc) return { error: 'שירות לא נמצא' };

      const duration = svc.duration_minutes as number;
      const dayDate = new Date(`${date}T00:00:00`);
      const weekday = dayDate.getDay();

      // Fallback to default hours if the clinic hasn't configured any:
      // Sun-Thu 9-17, Fri 9-13, Sat closed.
      const defaultHours: Array<{ weekday: number; start: string; end: string; open: boolean }> = [
        { weekday: 0, start: '09:00', end: '17:00', open: true },
        { weekday: 1, start: '09:00', end: '17:00', open: true },
        { weekday: 2, start: '09:00', end: '17:00', open: true },
        { weekday: 3, start: '09:00', end: '17:00', open: true },
        { weekday: 4, start: '09:00', end: '17:00', open: true },
        { weekday: 5, start: '09:00', end: '13:00', open: true },
        { weekday: 6, start: '09:00', end: '17:00', open: false },
      ];

      const configured = (hours ?? []) as Array<{
        weekday: number;
        start_time: string | null;
        end_time: string | null;
        is_open: boolean;
      }>;

      let startTime: string;
      let endTime: string;
      let isOpen: boolean;

      if (configured.length > 0) {
        const wh = configured.find((h) => h.weekday === weekday);
        if (!wh || !wh.is_open) {
          return { date, weekday, open: false, slots: [], note: 'הרופא לא עובד ביום הזה' };
        }
        startTime = wh.start_time ?? '09:00';
        endTime = wh.end_time ?? '17:00';
        isOpen = true;
      } else {
        const def = defaultHours[weekday];
        if (!def.open) {
          return { date, weekday, open: false, slots: [], note: 'יום שאינו עבודה (ברירת מחדל)' };
        }
        startTime = def.start;
        endTime = def.end;
        isOpen = true;
      }

      const dayStart = new Date(`${date}T${startTime}`);
      const dayEnd = new Date(`${date}T${endTime}`);
      void isOpen;

      // existing appointments for that doctor that day
      const dayStartIso = new Date(`${date}T00:00:00Z`).toISOString();
      const dayEndIso = new Date(`${date}T23:59:59Z`).toISOString();
      const { data: appts, error: aErr } = await sb
        .from('appointments')
        .select('start_at, end_at, status')
        .eq('doctor_id', doctor_id)
        .gte('start_at', dayStartIso)
        .lte('start_at', dayEndIso)
        .neq('status', 'cancelled');
      if (aErr) return { error: aErr.message };

      const taken = (appts ?? []).map((a: any) => ({
        start: new Date(a.start_at).getTime(),
        end: new Date(a.end_at).getTime(),
      }));

      // build candidate slots every `duration` minutes
      const slots: string[] = [];
      const stepMs = Math.max(15, Math.min(30, duration)) * 60_000;
      for (let t = dayStart.getTime(); t + duration * 60_000 <= dayEnd.getTime(); t += stepMs) {
        const slotEnd = t + duration * 60_000;
        const overlaps = taken.some((x) => !(slotEnd <= x.start || t >= x.end));
        if (!overlaps && t > Date.now()) slots.push(new Date(t).toISOString());
        if (slots.length >= 12) break;
      }

      return { date, weekday, open: true, duration_minutes: duration, slots };
    },

    async book_appointment({
      doctor_id,
      service_id,
      start_at,
      notes,
    }: {
      doctor_id: string;
      service_id: string;
      start_at: string;
      notes?: string;
    }): Promise<unknown> {
      const { data: svc, error: svcErr } = await sb
        .from('services')
        .select('duration_minutes, name')
        .eq('id', service_id)
        .maybeSingle();
      if (svcErr) return { error: svcErr.message };
      if (!svc) return { error: 'שירות לא נמצא' };

      const start = new Date(start_at);
      if (Number.isNaN(start.getTime())) return { error: 'תאריך לא תקין' };
      if (start.getTime() < Date.now()) return { error: 'לא ניתן לקבוע תור לעבר' };
      const end = new Date(start.getTime() + (svc.duration_minutes as number) * 60_000);

      const { data, error } = await sb
        .from('appointments')
        .insert({
          client_id: userId,
          doctor_id,
          service_id,
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          notes: notes ?? null,
          status: 'pending',
          created_by: userId,
        })
        .select('id, start_at, end_at')
        .single();

      if (error) {
        const msg = error.message?.toLowerCase() ?? '';
        if (msg.includes('overlap') || error.code === '23P01') {
          return { error: 'הזמן הזה תפוס. נסה זמן אחר.' };
        }
        return { error: error.message };
      }
      return {
        success: true,
        appointment_id: data.id,
        service: svc.name,
        start_at: data.start_at,
        end_at: data.end_at,
      };
    },
  };
}

// ── Gemini conversation loop ────────────────────────────────────────────────

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: unknown } };

type GeminiMessage = { role: 'user' | 'model' | 'function'; parts: GeminiPart[] };

async function callGemini(messages: GeminiMessage[]) {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildSystemPrompt() }] },
      contents: messages,
      tools: TOOLS,
      generationConfig: { temperature: 0.2 },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── HTTP handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    // Build a Supabase client bound to the user's JWT — RLS applies as them.
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: uErr } = await sb.auth.getUser();
    if (uErr || !userData?.user) {
      return jsonResponse({ error: 'Invalid auth' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const { history = [], message } = body as {
      history?: GeminiMessage[];
      message: string;
    };
    if (typeof message !== 'string' || !message.trim()) {
      return jsonResponse({ error: 'message is required' }, 400);
    }

    const tools = makeTools(sb, userData.user.id);
    // Tail-truncate history to the last HISTORY_LIMIT messages so the prompt
    // stays small. We preserve any tool-call/response pairs at the boundary.
    const trimmedHistory = history.slice(-HISTORY_LIMIT);
    const messages: GeminiMessage[] = [
      ...trimmedHistory,
      { role: 'user', parts: [{ text: message }] },
    ];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const data = await callGemini(messages);
      const candidate = data?.candidates?.[0];
      const parts: GeminiPart[] = candidate?.content?.parts ?? [];
      if (!parts.length) {
        return jsonResponse({ error: 'Empty Gemini response', raw: data }, 502);
      }

      // record model turn
      messages.push({ role: 'model', parts });

      const fc = parts.find((p: any) => p.functionCall)?.['functionCall' as any] as
        | { name: string; args: Record<string, unknown> }
        | undefined;

      if (!fc) {
        const text = parts.map((p: any) => p.text ?? '').filter(Boolean).join('\n').trim();
        return jsonResponse({ reply: text, history: messages });
      }

      // execute tool
      const fn = (tools as any)[fc.name];
      let result: unknown;
      if (!fn) {
        result = { error: `Unknown tool: ${fc.name}` };
      } else {
        try {
          result = await fn(fc.args ?? {});
        } catch (e) {
          result = { error: (e as Error).message };
        }
      }

      messages.push({
        role: 'function',
        parts: [{ functionResponse: { name: fc.name, response: result as any } }],
      });
    }

    return jsonResponse({ error: 'Exceeded tool-call limit', history: messages }, 500);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
