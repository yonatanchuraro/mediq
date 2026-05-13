import { useEffect, useRef, useState } from 'react';
import { Loader2, MessageSquare, RotateCcw, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/layouts/AppShell';
import { cn } from '@/lib/utils';

type Role = 'user' | 'model' | 'function';
type Part =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: unknown } };

interface Msg {
  role: Role;
  parts: Part[];
}

const SUGGESTIONS = [
  'אני רוצה לקבוע תור לבדיקה כללית בימים הקרובים',
  'יש לי כאב גרון מתמשך, איזה רופא אתה מציע?',
  'מה השעות הפנויות של הרופאים מחר?',
];

export default function BookingChat() {
  const [history, setHistory] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history, sending]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    setDraft('');
    setSending(true);

    // optimistic add
    const userMsg: Msg = { role: 'user', parts: [{ text: message }] };
    const localHistory = [...history, userMsg];
    setHistory(localHistory);

    try {
      const { data, error } = await supabase.functions.invoke('gemini-chat', {
        body: { history, message },
      });
      // supabase-js wraps non-2xx into a generic FunctionsHttpError and
      // stashes the real Response in error.context — read its body so the
      // user sees the actual server message instead of "non-2xx status code".
      if (error) {
        let detail: string | undefined;
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.text === 'function') {
          try {
            const body = await ctx.text();
            try {
              detail = JSON.parse(body)?.error ?? body;
            } catch {
              detail = body;
            }
          } catch { /* ignore body read errors */ }
        }
        throw new Error(detail || error.message);
      }
      if (data?.error) throw new Error(data.error);
      if (data?.history) {
        setHistory(data.history as Msg[]);
      } else if (data?.reply) {
        setHistory([...localHistory, { role: 'model', parts: [{ text: data.reply }] }]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בצ׳אט');
      // rollback optimistic user message? keep it so user sees what they sent.
    } finally {
      setSending(false);
    }
  }

  function reset() {
    if (history.length && !confirm('להתחיל שיחה חדשה?')) return;
    setHistory([]);
    setDraft('');
  }

  const visible = history.filter(
    (m) => m.role !== 'function' && m.parts.some((p) => 'text' in p && p.text)
  );

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <PageHeader
        title="עוזר ההזמנה"
        description="כתוב מה שאתה צריך — אני אעזור למצוא רופא ולקבוע תור"
        action={
          history.length > 0 && (
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw className="h-4 w-4" />
              שיחה חדשה
            </Button>
          )
        }
      />

      <Card className="flex flex-1 flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
          {visible.length === 0 && !sending ? (
            <EmptyState onPick={send} />
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              {visible.map((m, i) => (
                <Bubble key={i} role={m.role} text={textOf(m)} />
              ))}
              {sending && <TypingBubble />}
            </div>
          )}
        </div>

        <CardContent className="border-t bg-card p-4">
          <form
            className="mx-auto flex max-w-3xl gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
          >
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              placeholder="לדוגמה: אני רוצה תור לרופא משפחה בשבוע הבא…"
              rows={1}
              className="min-h-[44px] flex-1 resize-none"
              disabled={sending}
            />
            <Button type="submit" disabled={!draft.trim() || sending} size="icon" className="h-[44px] w-[44px] shrink-0">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
          <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-muted-foreground">
            Enter לשליחה · Shift+Enter לשורה חדשה
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function textOf(m: Msg): string {
  return m.parts
    .map((p) => ('text' in p ? p.text : ''))
    .filter(Boolean)
    .join('\n');
}

function Bubble({ role, text }: { role: Role; text: string }) {
  const isUser = role === 'user';
  return (
    <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-teal-400 text-white shadow-md shadow-primary/30">
          <Sparkles className="h-4 w-4" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'rounded-bl-md bg-primary text-primary-foreground'
            : 'rounded-br-md border bg-card text-card-foreground shadow-sm'
        )}
      >
        {text}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start gap-3">
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-teal-400 text-white shadow-md shadow-primary/30">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-br-md border bg-card px-4 py-3 shadow-sm">
        <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
        <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
        <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground/60" />
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center gap-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-teal-400 text-white shadow-lg shadow-primary/30">
        <MessageSquare className="h-7 w-7" />
      </div>
      <div>
        <h3 className="text-xl font-bold">איך אפשר לעזור?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          אני אעזור למצוא רופא, לבדוק זמינות ולקבוע תור — הכל בשיחה אחת
        </p>
      </div>
      <div className="grid w-full gap-2 sm:grid-cols-1">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-xl border bg-card p-3 text-right text-sm transition-colors hover:border-primary hover:bg-primary/5"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
