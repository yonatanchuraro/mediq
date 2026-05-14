import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.local.example → .env.local and fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.'
  );
}

// Note: we leave the client untyped for now (no Database<T> generic).
// Later we can regenerate strict types via `supabase gen types typescript ...`
// and re-add the generic. For now Row shapes are explicit in src/types/database.types.ts.
export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Cold-start pre-warm. On NANO / free-tier Supabase, the Postgres compute is
// shared and sleeps between visits — the first query after idle can take
// 30-60s. Firing a throwaway query on module load means the wake-up happens
// in parallel with React mounting + auth bootstrap, so by the time
// loadProfile runs the compute is already warm. Fire-and-forget — RLS will
// return empty for the anon key which is fine; we only care about the wake.
void supabase
  .from('profiles')
  .select('id')
  .limit(1)
  .then(
    () => {},
    () => {}
  );
