import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) {
      console.error('[auth] failed to load profile:', error.message);
      setProfile(null);
      return;
    }
    setProfile(data as Profile);
  }, []);

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
      await loadProfile(userData.user.id);
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (!mounted) return;
      setSession(s);
      if (s && event !== 'INITIAL_SESSION') {
        // Don't re-fetch on initial — the bootstrap above handles it.
        await loadProfile(s.user.id);
      } else if (!s) {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

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
    await supabase.auth.signOut();
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
