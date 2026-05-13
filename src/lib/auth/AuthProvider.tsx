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
  }) => Promise<void>;
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
      const run = (async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
          if (!error) {
            setProfile(data as Profile);
            setProfileError(null);
            return;
          }

          // No row at all — try to create one from the auth metadata, once.
          if (error.code === 'PGRST116') {
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
          console.error('[auth] failed to load profile after retries:', error.message);
          setProfileError(error.message);
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
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!mounted) return;

      if (!sessionData.session) {
        setSession(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      const { data: userData, error } = await supabase.auth.getUser();
      if (!mounted) return;

      if (error || !userData?.user) {
        console.warn('[auth] stored session invalid — signing out:', error?.message);
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setSession(sessionData.session);
      await loadProfile(userData.user.id, { clearOnFail: true });
      setLoading(false);
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
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Eagerly seed session + profile so the caller can navigate immediately
      // without racing onAuthStateChange. Without this, RootRedirect renders
      // with the *previous* user's state (or null) and may flash a loader or
      // mis-route until the listener catches up.
      if (data.session) {
        setSession(data.session);
        await loadProfile(data.session.user.id);
      }
    },
    [loadProfile]
  );

  const signUp: AuthContextValue['signUp'] = useCallback(
    async ({ email, password, full_name, phone }) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name, phone } },
      });
      if (error) throw error;
    },
    []
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
