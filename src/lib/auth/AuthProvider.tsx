import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database.types';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (data: {
    email: string;
    password: string;
    full_name: string;
    phone?: string;
  }) => Promise<{ session: Session | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  // Dedupe in-flight profile loads. supabase's onAuthStateChange fires
  // SIGNED_IN during signInWithPassword, and our signIn() also calls
  // loadProfile directly — without this guard both run in parallel and the
  // PGRST116 back-fill can race itself into a duplicate-key error.
  const inFlight = useRef<Promise<void> | null>(null);
  const inFlightUserId = useRef<string | null>(null);

  // Loads the user's profile with 2 retries and exponential backoff. On
  // transient failure we deliberately do NOT clobber the existing profile
  // (returning to it would leave the user stuck on a Loader). The bootstrap
  // path passes `clearOnFail` so the first-load case can still drop to null.
  //
  // If the profile row is missing entirely (PGRST116) we attempt to back-fill
  // it from the auth user's metadata — this rescues accounts where the
  // handle_new_user trigger didn't run or whose row was deleted manually.
  const loadProfile = useCallback(
    async (userId: string, { clearOnFail = false }: { clearOnFail?: boolean } = {}) => {
      // If a load for the same user is already running, just await it.
      if (inFlight.current && inFlightUserId.current === userId) {
        return inFlight.current;
      }
      // Race the supabase fetch against a hard timeout. A hung promise (network
      // blip, dropped connection, Supabase free-tier cold start) used to wedge
      // the dedup forever; now it surfaces as a normal error after `ms` so the
      // user sees a real message. 15s is generous enough that a sleepy free-
      // tier project waking up has time to respond.
      const withTimeout = <T,>(p: PromiseLike<T>, ms = 15000): Promise<T> =>
        Promise.race([
          Promise.resolve(p),
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)
          ),
        ]);
      const run = (async () => {
        try {
          for (let attempt = 0; attempt < 3; attempt++) {
            // maybeSingle() instead of single(): an RLS-filtered row count of
            // 0 returns data=null + error=null rather than a 406 / PGRST116,
            // letting us distinguish "row is missing" from "request failed".
            const { data, error } = await withTimeout(
              supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
            );
            if (!error && data) {
              setProfile(data as Profile);
              setProfileError(null);
              return;
            }
            // Treat "no row found" (either explicit PGRST116 from .single, or
            // null data from .maybeSingle) as a missing-profile situation.
            const isMissing =
              !error && !data
                ? true
                : error?.code === 'PGRST116' || /coerce.*single/i.test(error?.message ?? '');

            if (isMissing) {
              const { data: userData } = await supabase.auth.getUser();
              const u = userData?.user;
              if (u) {
                const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
                const { data: inserted, error: insErr } = await supabase
                  .from('profiles')
                  .insert({
                    id: u.id,
                    email: u.email,
                    full_name:
                      (meta.full_name as string) ?? u.email?.split('@')[0] ?? null,
                    phone: (meta.phone as string) ?? null,
                    role: 'client',
                  })
                  .select('*')
                  .single();
                if (!insErr && inserted) {
                  setProfile(inserted as Profile);
                  setProfileError(null);
                  return;
                }
                // Duplicate-key just means a parallel call beat us to it —
                // re-read and treat as success.
                if (insErr?.code === '23505') {
                  const { data: again } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', userId)
                    .single();
                  if (again) {
                    setProfile(again as Profile);
                    setProfileError(null);
                    return;
                  }
                }
                console.error('[auth] profile back-fill failed:', insErr?.message);
                setProfileError(
                  `שורת הפרופיל חסרה ולא הצלחנו ליצור אותה (${insErr?.message ?? 'unknown'}).`
                );
                if (clearOnFail) setProfile(null);
                return;
              }
            }

            if (attempt < 2) {
              await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
              continue;
            }
            const finalMsg =
              error?.message ?? 'פרופיל לא נמצא — ייתכן שה-RLS חוסם או שה-id לא תואם.';
            console.error('[auth] failed to load profile after retries:', finalMsg);
            setProfileError(finalMsg);
            if (clearOnFail) setProfile(null);
          }
        } catch (e) {
          // Network failure or any unexpected throw — make sure we record an
          // error and don't leave the caller stuck on a null profile with no
          // diagnostic info. Previously this propagated to the bootstrap and
          // skipped setLoading(false), producing a permanent silent stuck state.
          const msg = e instanceof Error ? e.message : 'שגיאה לא צפויה בטעינת הפרופיל';
          console.error('[auth] loadProfile threw:', e);
          setProfileError(msg);
          if (clearOnFail) setProfile(null);
        }
      })();
      inFlight.current = run;
      inFlightUserId.current = userId;
      try {
        await run;
      } finally {
        inFlight.current = null;
        inFlightUserId.current = null;
      }
    },
    []
  );

  useEffect(() => {
    let mounted = true;

    // Initial load: validate the session against the server (getUser hits the
    // network; getSession only reads localStorage). If the stored session is
    // expired or invalid, sign out cleanly so the user lands on /login instead
    // of being stuck on a loader forever.
    //
    // The outer try/finally guarantees setLoading(false) runs even when
    // something inside throws — previously an unexpected throw left
    // `loading=true` and the UI on a permanent loader.
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!mounted) return;

        if (!sessionData.session) {
          setSession(null);
          setProfile(null);
          return;
        }

        const { data: userData, error } = await supabase.auth.getUser();
        if (!mounted) return;

        if (error || !userData?.user) {
          console.warn('[auth] stored session invalid — signing out:', error?.message);
          await supabase.auth.signOut();
          setSession(null);
          setProfile(null);
          return;
        }

        setSession(sessionData.session);
        await loadProfile(userData.user.id, { clearOnFail: true });
      } catch (e) {
        console.error('[auth] bootstrap threw:', e);
        setProfileError(e instanceof Error ? e.message : 'אתחול נכשל');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (!mounted) return;
      setSession(s);
      if (!s) {
        setProfile(null);
        setProfileError(null);
        return;
      }
      // Skip reload on bootstrap (handled above) and on TOKEN_REFRESHED — the
      // profile row doesn't change when only the JWT is renewed, and a bad
      // network blip during refresh used to leave us stuck on null. Only
      // re-fetch when the *user* actually changed.
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        await loadProfile(s.user.id);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      // Hard-reset every trace of any previous session before authenticating.
      // Stale sb-* tokens / lingering supabase-js internal state were the
      // root of the user-switching bugs — the new sign-in occasionally ran
      // queries with the wrong JWT until the listener caught up. Clearing
      // synchronously up-front makes the flow deterministic.
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        /* ignore — we're going to overwrite anyway */
      }
      try {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith('sb-')) localStorage.removeItem(key);
        }
      } catch {
        /* no-op */
      }
      setSession(null);
      setProfile(null);
      setProfileError(null);

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Eagerly seed session + profile so the caller can navigate immediately
      // without racing onAuthStateChange.
      if (data.session) {
        setSession(data.session);
        await loadProfile(data.session.user.id);
      }
    },
    [loadProfile]
  );

  const signUp: AuthContextValue['signUp'] = useCallback(
    async ({ email, password, full_name, phone }) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name, phone } },
      });
      if (error) throw error;
      // Supabase quirk: when the email already exists it does NOT return an
      // error — it returns a fake user object with an empty identities array
      // to avoid leaking which addresses are registered. Detect and surface
      // a real error so the signup form doesn't pretend it succeeded.
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        throw new Error('האימייל הזה כבר רשום. נסה להתחבר במקום.');
      }
      // If session is null after signUp the project has "Confirm email"
      // enabled — the caller should show a "check your inbox" message
      // instead of navigating into the app.
      if (data.session) {
        setSession(data.session);
        await loadProfile(data.session.user.id);
      }
      return { session: data.session, needsConfirmation: !data.session };
    },
    [loadProfile]
  );

  const signOut = useCallback(async () => {
    // Order matters here:
    //   1. Clear React state so the UI reacts instantly and ProtectedRoute
    //      redirects to /login.
    //   2. Nuke localStorage synchronously, BEFORE the async signOut() —
    //      otherwise the cleanup races a fast subsequent signInWithPassword
    //      (e.g. user logging in as a different account) and wipes the
    //      *new* user's tokens, leaving them in a "stuck" half-authed state.
    //   3. Then fire the network signOut, which invalidates the refresh
    //      token server-side. Errors are non-fatal — local state is already
    //      cleared.
    setSession(null);
    setProfile(null);
    setProfileError(null);
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('sb-')) localStorage.removeItem(key);
      }
    } catch {
      /* no-op */
    }
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('[auth] signOut error (ignored — state already cleared):', e);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user.id) await loadProfile(session.user.id);
  }, [session?.user.id, loadProfile]);

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        profile,
        loading,
        profileError,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
