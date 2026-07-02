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
    const qs = new URLSearchParams(window.location.search);
    const hs = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const errDesc = qs.get("error_description") ?? hs.get("error_description");
    if (errDesc) toast.error(decodeURIComponent(errDesc.replace(/\+/g, " ")));

    // ── OAuth-return diagnostics (temporary) ─────────────────────────────────
    // Reports exactly what came back and whether a session was established, so
    // we can tell a config failure (no code) from a storage failure (code but
    // no verifier). Remove once the redirect flow is confirmed working.
    const verifierKey = Object.keys(localStorage).find(k => k.endsWith("-code-verifier"));
    const diag = {
      href: window.location.href,
      hasCode: qs.has("code"),
      hasImplicitToken: hs.has("access_token"),
      error: qs.get("error") ?? hs.get("error") ?? null,
      errorDescription: errDesc ?? null,
      codeVerifierInStorage: !!verifierKey,
    };

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setLoading(false);
        if ((diag.hasCode || diag.hasImplicitToken || diag.error) && !data.session) {
          // We came back from OAuth but no session was established.
          // eslint-disable-next-line no-console
          console.error("[auth] OAuth return produced no session:", diag);
          toast.error(
            diag.error
              ? `Google sign-in error: ${diag.error}`
              : diag.hasCode && !diag.codeVerifierInStorage
                ? "OAuth code returned but PKCE verifier is missing from this browser (storage/origin mismatch)."
                : "OAuth returned but no session — likely the redirect URL isn't allow-listed in Supabase.",
          );
        } else if (data.session) {
          // eslint-disable-next-line no-console
          console.info("[auth] session established", { fromOAuth: diag.hasCode || diag.hasImplicitToken });
        }
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
