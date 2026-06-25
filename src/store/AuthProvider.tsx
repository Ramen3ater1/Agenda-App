import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const GUEST_KEY = "agenda:guest";

interface AuthValue {
  user: User | null;
  loading: boolean;
  isGuest: boolean;
  continueAsGuest: () => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null; session: Session | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState(() => localStorage.getItem(GUEST_KEY) === "1");

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = useCallback<AuthValue["signIn"]>(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signUp = useCallback<AuthValue["signUp"]>(async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    return { error, session: data.session };
  }, []);

  const signInWithGoogle = useCallback<AuthValue["signInWithGoogle"]>(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    return { error };
  }, []);

  const continueAsGuest = useCallback<AuthValue["continueAsGuest"]>(() => {
    localStorage.setItem(GUEST_KEY, "1");
    setGuest(true);
  }, []);

  const signOut = useCallback<AuthValue["signOut"]>(async () => {
    localStorage.removeItem(GUEST_KEY);
    setGuest(false);
    await supabase.auth.signOut();
  }, []);

  const user = session?.user ?? null;
  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      isGuest: !user && guest,
      continueAsGuest,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
    }),
    [user, loading, guest, continueAsGuest, signIn, signUp, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
