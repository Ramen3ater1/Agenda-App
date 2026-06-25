import { useState, type FormEvent } from "react";
import { useNavigate, useLocation, Link } from "react-router";
import { useAuth } from "@/store/AuthProvider";
import AuthCard from "./AuthCard";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isSignup = mode === "signup";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/today";

  function validate(): string {
    if (!EMAIL_RE.test(email)) return "Enter a valid email address";
    if (password.length < 6) return "Password should be at least 6 digits";
    return "";
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(""); setNotice("");
    const v = validate();
    if (v) { setError(v); return; }
    setLoading(true);
    if (isSignup) {
      const { error, session } = await signUp(email, password);
      setLoading(false);
      if (error) { setError(error.message); return; }
      if (!session) { setNotice("Successfully signed up for Agenda! Check confirmation email."); return; }
      navigate(from, { replace: true });
    } else {
      const { error } = await signIn(email, password);
      setLoading(false);
      if (error) { setError(error.message); return; }
      navigate(from, { replace: true });
    }
  }

  async function onGoogle() {
    setError(""); setNotice("");
    const { error } = await signInWithGoogle();
    if (error) setError(error.message);
  }

  const inputCls =
    "w-full px-3 py-2.5 rounded-md bg-card border border-border text-sm text-foreground outline-none focus:border-accent transition-colors placeholder:text-muted-foreground";

  return (
    <AuthCard
      title={isSignup ? "Create your account" : "Welcome back"}
      subtitle={isSignup ? "Start planning and tracking your work." : "Sign in to continue to Agenda."}
    >
      <button
        type="button"
        onClick={onGoogle}
        aria-label="Continue with Google"
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 mb-4 rounded-md border border-border text-sm font-medium text-foreground hover:bg-card transition-colors"
      >
        <span className="font-semibold text-accent">G</span> Continue with Google
      </button>

      <div className="flex items-center gap-3 mb-4">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <label htmlFor="email" className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Email</span>
          <input
            id="email"
            aria-label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputCls}
          />
        </label>
        <label htmlFor="password" className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Password</span>
          <input
            id="password"
            aria-label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={inputCls}
          />
        </label>

        {error && <p className="text-xs text-red-400">{error}</p>}
        {notice && <p className="text-xs text-emerald-400">{notice}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 w-full px-4 py-2.5 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="text-center text-xs text-muted-foreground mt-5">
        {isSignup ? "Already have an account? " : "Don't have an account? "}
        <Link
          to={isSignup ? "/login" : "/signup"}
          className="text-accent font-medium hover:underline"
        >
          {isSignup ? "Sign in" : "Sign up"}
        </Link>
      </p>
    </AuthCard>
  );
}
