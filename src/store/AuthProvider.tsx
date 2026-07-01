import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const GUEST_KEY = "agenda:guest";

interface AuthValue {
  user: User | null;
  loading: boolean;
  isGuest: boolean;
  // Google OAuth access token from the current Supabase session (present right
  // after an OAuth sign-in). Used to call the Google Calendar API.
  providerToken: string | null;
  continueAsGuest: () => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null; session: Session | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  // Re-runs Google OAuth requesting the Calendar scope so we can read/write events.
  connectGoogleCalendar: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState(() => localStorage.getItem(GUEST_KEY) === "1");

  useEffect(() => {
    // Surface an OAuth failure the provider handed back in the URL (e.g. the
    // redirect URL isn't allow-listed), instead of silently landing on /login.
    const qs = new URLSearchParams(window.location.search);
    const hs = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const errDesc = qs.get("error_description") ?? hs.get("error_description");
    if (errDesc) toast.error(decodeURIComponent(errDesc.replace(/\+/g, " ")));

    // getSession() awaits supabase's URL processing, so on an OAuth return it
    // resolves with the freshly exchanged session.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
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

  const connectGoogleCalendar = useCallback<AuthValue["connectGoogleCalendar"]>(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "https://www.googleapis.com/auth/calendar.events",
        redirectTo: window.location.origin,
        queryParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
      },
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
  const providerToken = session?.provider_token ?? null;
  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      isGuest: !user && guest,
      providerToken,
      continueAsGuest,
      signIn,
      signUp,
      signInWithGoogle,
      connectGoogleCalendar,
      signOut,
    }),
    [user, loading, guest, providerToken, continueAsGuest, signIn, signUp, signInWithGoogle, connectGoogleCalendar, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
