# Supabase 邮箱密码 + Google 登录 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 Agenda 加上 Supabase 鉴权与登录界面，未登录用户被挡在主应用之外，登录后才能访问任务数据。

**Architecture:** 方案 A —— 新增 `AuthProvider`（React Context，订阅 `supabase.auth.onAuthStateChange`，暴露 `useAuth()`），用 `AuthGuard` 路由守卫包住受保护路由。`TaskProvider`/`TimerProvider` 被挪进守卫内侧，确保只有登录后才加载用户数据。登录/注册是无 Sidebar 的独立路由。

**Tech Stack:** React 18 + TypeScript + Vite + react-router v7（从 `"react-router"` 导入）+ @supabase/supabase-js v2 + Tailwind v4 + lucide-react + Vitest 4 + @testing-library/react v16（含 `renderHook`）。

## Global Constraints

- react-router 的所有 import 必须来自 `"react-router"`，**不是** `react-router-dom`（未安装）。
- `@` 路径别名 → `src`（vite.config.ts / vitest.config.ts 已配）。
- Supabase 客户端已存在于 `src/lib/supabase.ts`，导出名为 `supabase`，env 用 `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`。
- 提交信息**不要**包含任何 `Co-Authored-By` / Co-author 字样（用户全局规则）。
- tsc 当前有 2 个**预先存在**的报错（`src/main.tsx` 的 TS7016 / TS2882），与本功能无关。验证门槛是「**不引入新的 tsc 报错**」，且 `npm run build` 与 `npm test` 必须通过。
- 数据仍读写 localStorage（`agenda:v1` 不动）。本计划不把业务数据搬上 Supabase。
- 不要改 `peerDependencies`。

---

## File Structure

**新增**
- `src/store/AuthProvider.tsx` — 鉴权 Context + `useAuth()`
- `src/store/AuthProvider.test.tsx` — Provider 单测（mock supabase）
- `src/features/auth/AuthSplash.tsx` — 会话恢复期的全屏占位
- `src/routes/AuthGuard.tsx` — 路由守卫
- `src/routes/AuthGuard.test.tsx` — 守卫单测（mock useAuth + MemoryRouter）
- `src/features/auth/AuthCard.tsx` — 登录页视觉外壳
- `src/features/auth/AuthForm.tsx` — 登录/注册表单（`mode` prop）
- `src/features/auth/AuthForm.test.tsx` — 表单校验/提交单测
- `src/features/auth/index.ts` — barrel
- `src/routes/LoginRoute.tsx` — `/login` 薄壳
- `src/routes/SignupRoute.tsx` — `/signup` 薄壳
- `src/routes/ProtectedProviders.tsx` — 把 Task/Timer Provider 包成一个路由元素

**改动**
- `src/app/App.tsx` — 插入 AuthProvider + login/signup 路由 + AuthGuard + ProtectedProviders 嵌套
- `src/features/sidebar/Sidebar.tsx` — 账号底栏改为真实邮箱 + 登出按钮
- `src/routes/Layout.tsx` — Onboarding 标记按用户 id 区分

---

## Task 1: AuthProvider + useAuth

**Files:**
- Create: `src/store/AuthProvider.tsx`
- Test: `src/store/AuthProvider.test.tsx`

**Interfaces:**
- Consumes: `supabase` from `@/lib/supabase`.
- Produces:
  - `AuthProvider({ children }: { children: ReactNode })` — React 组件。
  - `useAuth(): AuthValue`，其中
    ```ts
    interface AuthValue {
      user: import("@supabase/supabase-js").User | null;
      loading: boolean;
      signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
      signUp: (email: string, password: string) =>
        Promise<{ error: Error | null; session: import("@supabase/supabase-js").Session | null }>;
      signInWithGoogle: () => Promise<{ error: Error | null }>;
      signOut: () => Promise<void>;
    }
    ```

- [ ] **Step 1: 写失败的测试**

`src/store/AuthProvider.test.tsx`:
```tsx
import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "@/store/AuthProvider";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

beforeEach(() => {
  vi.clearAllMocks();
  (supabase.auth.onAuthStateChange as Mock).mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
});

describe("AuthProvider", () => {
  it("starts loading, then exposes the restored user", async () => {
    (supabase.auth.getSession as Mock).mockResolvedValue({
      data: { session: { user: { id: "u1", email: "a@b.com" } } },
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user?.email).toBe("a@b.com");
  });

  it("has null user when no session", async () => {
    (supabase.auth.getSession as Mock).mockResolvedValue({ data: { session: null } });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it("forwards signIn to supabase", async () => {
    (supabase.auth.getSession as Mock).mockResolvedValue({ data: { session: null } });
    (supabase.auth.signInWithPassword as Mock).mockResolvedValue({ error: null });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.signIn("a@b.com", "secret123"); });
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "a@b.com", password: "secret123",
    });
  });

  it("updates user when onAuthStateChange fires", async () => {
    (supabase.auth.getSession as Mock).mockResolvedValue({ data: { session: null } });
    let cb: (e: string, s: unknown) => void = () => {};
    (supabase.auth.onAuthStateChange as Mock).mockImplementation((fn: typeof cb) => {
      cb = fn;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { cb("SIGNED_IN", { user: { id: "u2", email: "c@d.com" } }); });
    await waitFor(() => expect(result.current.user?.email).toBe("c@d.com"));
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- src/store/AuthProvider.test.tsx`
Expected: FAIL —— 模块 `@/store/AuthProvider` 不存在 / `useAuth` 未定义。

- [ ] **Step 3: 写实现**

`src/store/AuthProvider.tsx`:
```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null; session: Session | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthValue = {
    user: session?.user ?? null,
    loading,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    },
    signUp: async (email, password) => {
      const { data, error } = await supabase.auth.signUp({ email, password });
      return { error, session: data.session };
    },
    signInWithGoogle: async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      return { error };
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- src/store/AuthProvider.test.tsx`
Expected: PASS（4 个用例全过）。

- [ ] **Step 5: 提交**

```bash
git add src/store/AuthProvider.tsx src/store/AuthProvider.test.tsx
git commit -m "feat(auth): add AuthProvider with useAuth hook"
```

---

## Task 2: AuthSplash + AuthGuard

**Files:**
- Create: `src/features/auth/AuthSplash.tsx`
- Create: `src/routes/AuthGuard.tsx`
- Test: `src/routes/AuthGuard.test.tsx`

**Interfaces:**
- Consumes: `useAuth` from `@/store/AuthProvider`（Task 1）。
- Produces:
  - `AuthSplash()` — 默认导出，全屏加载占位组件。
  - `AuthGuard()` — 默认导出，路由元素：`loading`→`<AuthSplash/>`；无 `user`→`<Navigate to="/login" replace state={{ from: location }}/>`；否则 `<Outlet/>`。

- [ ] **Step 1: 写 AuthSplash（无单测，纯展示，随 AuthGuard 一起验证）**

`src/features/auth/AuthSplash.tsx`:
```tsx
import { Zap } from "lucide-react";

export default function AuthSplash() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-background"
      style={{ fontFamily: "'Instrument Sans', sans-serif" }}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="size-9 rounded-lg bg-accent flex items-center justify-center animate-pulse">
          <Zap size={18} className="text-white" />
        </div>
        <span className="text-xs text-muted-foreground">Loading…</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 写失败的测试**

`src/routes/AuthGuard.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import AuthGuard from "@/routes/AuthGuard";
import { useAuth } from "@/store/AuthProvider";

vi.mock("@/store/AuthProvider", () => ({ useAuth: vi.fn() }));

function renderAt() {
  return render(
    <MemoryRouter initialEntries={["/today"]}>
      <Routes>
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
        <Route element={<AuthGuard />}>
          <Route path="/today" element={<div>PROTECTED</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("AuthGuard", () => {
  it("shows splash while loading", () => {
    (useAuth as Mock).mockReturnValue({ user: null, loading: true });
    renderAt();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("redirects to /login when unauthenticated", () => {
    (useAuth as Mock).mockReturnValue({ user: null, loading: false });
    renderAt();
    expect(screen.getByText("LOGIN PAGE")).toBeInTheDocument();
  });

  it("renders the outlet when authenticated", () => {
    (useAuth as Mock).mockReturnValue({ user: { id: "u1" }, loading: false });
    renderAt();
    expect(screen.getByText("PROTECTED")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npm test -- src/routes/AuthGuard.test.tsx`
Expected: FAIL —— `@/routes/AuthGuard` 不存在。

- [ ] **Step 4: 写实现**

`src/routes/AuthGuard.tsx`:
```tsx
import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/store/AuthProvider";
import AuthSplash from "@/features/auth/AuthSplash";

export default function AuthGuard() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <AuthSplash />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npm test -- src/routes/AuthGuard.test.tsx`
Expected: PASS（3 个用例全过）。

- [ ] **Step 6: 提交**

```bash
git add src/features/auth/AuthSplash.tsx src/routes/AuthGuard.tsx src/routes/AuthGuard.test.tsx
git commit -m "feat(auth): add AuthGuard route guard and loading splash"
```

---

## Task 3: AuthCard + AuthForm + barrel + 登录/注册路由

**Files:**
- Create: `src/features/auth/AuthCard.tsx`
- Create: `src/features/auth/AuthForm.tsx`
- Create: `src/features/auth/index.ts`
- Create: `src/routes/LoginRoute.tsx`
- Create: `src/routes/SignupRoute.tsx`
- Test: `src/features/auth/AuthForm.test.tsx`

**Interfaces:**
- Consumes: `useAuth`（Task 1）；react-router 的 `useNavigate`/`useLocation`/`Link`/`Navigate`。
- Produces:
  - `AuthCard({ title, subtitle, children })` — 默认导出，视觉外壳。
  - `AuthForm({ mode }: { mode: "login" | "signup" })` — 默认导出。
  - barrel `src/features/auth/index.ts` 导出 `AuthForm`、`AuthCard`、`AuthSplash`。
  - `LoginRoute()` / `SignupRoute()` — 默认导出的路由组件。

- [ ] **Step 1: 写 AuthCard（纯展示）**

`src/features/auth/AuthCard.tsx`:
```tsx
import { Zap } from "lucide-react";
import type { ReactNode } from "react";

export default function AuthCard({
  title, subtitle, children,
}: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center bg-background px-6"
      style={{ fontFamily: "'Instrument Sans', sans-serif" }}
    >
      <div className="flex items-center gap-2.5 mb-8">
        <div className="size-7 rounded bg-accent flex items-center justify-center">
          <Zap size={13} className="text-white" />
        </div>
        <span className="font-semibold text-[15px] tracking-tight">Agenda</span>
      </div>
      <div className="w-full max-w-[360px]">
        <h1 className="text-2xl font-semibold tracking-tight mb-1.5 text-center">{title}</h1>
        <p className="text-sm text-muted-foreground text-center mb-7">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 写失败的测试**

`src/features/auth/AuthForm.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import AuthForm from "@/features/auth/AuthForm";
import { useAuth } from "@/store/AuthProvider";

vi.mock("@/store/AuthProvider", () => ({ useAuth: vi.fn() }));

const signIn = vi.fn();
const signUp = vi.fn();
const signInWithGoogle = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (useAuth as Mock).mockReturnValue({ signIn, signUp, signInWithGoogle });
});

function renderForm(mode: "login" | "signup") {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthForm mode={mode} />
    </MemoryRouter>,
  );
}

function fill(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
}

describe("AuthForm", () => {
  it("blocks invalid email without calling signIn", () => {
    renderForm("login");
    fill("not-an-email", "secret123");
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(screen.getByText("请输入有效的邮箱地址。")).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("blocks short password", () => {
    renderForm("login");
    fill("a@b.com", "123");
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(screen.getByText("密码至少 6 位。")).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("calls signIn with valid input", async () => {
    signIn.mockResolvedValue({ error: null });
    renderForm("login");
    fill("a@b.com", "secret123");
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith("a@b.com", "secret123"),
    );
  });

  it("renders server error from signIn", async () => {
    signIn.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    renderForm("login");
    fill("a@b.com", "secret123");
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() =>
      expect(screen.getByText("Invalid login credentials")).toBeInTheDocument(),
    );
  });

  it("calls signInWithGoogle when Google button clicked", async () => {
    signInWithGoogle.mockResolvedValue({ error: null });
    renderForm("login");
    fireEvent.click(screen.getByRole("button", { name: /google/i }));
    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalled());
  });

  it("in signup mode calls signUp", async () => {
    signUp.mockResolvedValue({ error: null, session: { user: { id: "u1" } } });
    renderForm("signup");
    fill("a@b.com", "secret123");
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => expect(signUp).toHaveBeenCalledWith("a@b.com", "secret123"));
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npm test -- src/features/auth/AuthForm.test.tsx`
Expected: FAIL —— `@/features/auth/AuthForm` 不存在。

- [ ] **Step 4: 写 AuthForm 实现**

`src/features/auth/AuthForm.tsx`:
```tsx
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
    if (!EMAIL_RE.test(email)) return "请输入有效的邮箱地址。";
    if (password.length < 6) return "密码至少 6 位。";
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
      if (!session) { setNotice("注册成功，请到邮箱点击确认链接后再登录。"); return; }
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
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 mb-4 rounded-md border border-border text-sm font-medium text-foreground hover:bg-card transition-colors"
      >
        <span className="font-semibold text-accent">G</span> Continue with Google
      </button>

      <div className="flex items-center gap-3 mb-4">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Email</span>
          <input
            aria-label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Password</span>
          <input
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
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npm test -- src/features/auth/AuthForm.test.tsx`
Expected: PASS（6 个用例全过）。

- [ ] **Step 6: 写 barrel 与两个路由薄壳**

`src/features/auth/index.ts`:
```ts
export { default as AuthForm } from "./AuthForm";
export { default as AuthCard } from "./AuthCard";
export { default as AuthSplash } from "./AuthSplash";
```

`src/routes/LoginRoute.tsx`:
```tsx
import { Navigate } from "react-router";
import { useAuth } from "@/store/AuthProvider";
import { AuthForm } from "@/features/auth";

export default function LoginRoute() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/today" replace />;
  return <AuthForm mode="login" />;
}
```

`src/routes/SignupRoute.tsx`:
```tsx
import { Navigate } from "react-router";
import { useAuth } from "@/store/AuthProvider";
import { AuthForm } from "@/features/auth";

export default function SignupRoute() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/today" replace />;
  return <AuthForm mode="signup" />;
}
```

- [ ] **Step 7: 全量测试确认无回归**

Run: `npm test`
Expected: PASS（原有 40 + 本计划新增用例全过）。

- [ ] **Step 8: 提交**

```bash
git add src/features/auth/ src/routes/LoginRoute.tsx src/routes/SignupRoute.tsx
git commit -m "feat(auth): add login/signup form, card shell, and routes"
```

---

## Task 4: ProtectedProviders + 接线 App.tsx

**Files:**
- Create: `src/routes/ProtectedProviders.tsx`
- Modify: `src/app/App.tsx`（整文件替换，见下）

**Interfaces:**
- Consumes: `AuthProvider`（T1）、`AuthGuard`（T2）、`LoginRoute`/`SignupRoute`（T3）、现有 `Layout`/`ListRoute`/`CalendarRoute`/`TaskRoute`、`TaskProvider`/`TimerProvider`。
- Produces: `ProtectedProviders()` —— 默认导出，渲染 `<TaskProvider><TimerProvider><Outlet/></TimerProvider></TaskProvider>`。

- [ ] **Step 1: 写 ProtectedProviders**

`src/routes/ProtectedProviders.tsx`:
```tsx
import { Outlet } from "react-router";
import { TaskProvider } from "@/store/TaskProvider";
import { TimerProvider } from "@/store/TimerProvider";

export default function ProtectedProviders() {
  return (
    <TaskProvider>
      <TimerProvider>
        <Outlet />
      </TimerProvider>
    </TaskProvider>
  );
}
```

- [ ] **Step 2: 替换 App.tsx 全文**

`src/app/App.tsx`（完整替换）:
```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AuthProvider } from "@/store/AuthProvider";
import AuthGuard from "@/routes/AuthGuard";
import ProtectedProviders from "@/routes/ProtectedProviders";
import Layout from "@/routes/Layout";
import ListRoute from "@/routes/ListRoute";
import CalendarRoute from "@/routes/CalendarRoute";
import TaskRoute from "@/routes/TaskRoute";
import LoginRoute from "@/routes/LoginRoute";
import SignupRoute from "@/routes/SignupRoute";

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/signup" element={<SignupRoute />} />
            <Route element={<AuthGuard />}>
              <Route element={<ProtectedProviders />}>
                <Route element={<Layout />}>
                  <Route index element={<Navigate to="/today" replace />} />
                  <Route path="today" element={<ListRoute scope="today" />} />
                  <Route path="all" element={<ListRoute scope="all" />} />
                  <Route path="folder/:folderId" element={<ListRoute scope="folder" />} />
                  <Route path="calendar" element={<CalendarRoute />} />
                  <Route path="task/:taskId" element={<TaskRoute />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/today" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
```

- [ ] **Step 3: 类型检查（不得引入新报错）**

Run: `npx tsc --noEmit`
Expected: 只剩 2 个**预先存在**的 `src/main.tsx` 报错（TS7016、TS2882）；不得出现其它文件的新报错。

- [ ] **Step 4: 构建确认通过**

Run: `npm run build`
Expected: 构建成功，dist 产出（与 tsc 分开运行，勿用 `&&` 串联，避免被预存 tsc 报错截断）。

- [ ] **Step 5: 全量测试确认无回归**

Run: `npm test`
Expected: PASS（全绿）。

- [ ] **Step 6: 提交**

```bash
git add src/routes/ProtectedProviders.tsx src/app/App.tsx
git commit -m "feat(auth): gate app routes behind AuthGuard and login/signup routes"
```

---

## Task 5: Sidebar 登出 + Layout 引导按用户区分

**Files:**
- Modify: `src/features/sidebar/Sidebar.tsx:156-164`（账号底栏）+ 顶部 import
- Modify: `src/routes/Layout.tsx`（Onboarding 标记 key）

**Interfaces:**
- Consumes: `useAuth`（T1）。
- Produces: 无新导出。Sidebar 底栏显示登录邮箱与「Sign out」按钮；Layout 的引导卡按 `ff_onboarded:${user.id}` 区分。

- [ ] **Step 1: 改 Sidebar import（第 1-2 行区域）**

把 `Sidebar.tsx` 顶部的两行 import 改为（新增 `LogOut` 图标 + `useAuth`）:
```tsx
import { useState } from "react";
import { CalendarDays, Plus, Trash2, Zap, Folder, Sun, Layers, LogOut } from "lucide-react";
import { isTodayTask } from "@/lib/utils";
import { useAuth } from "@/store/AuthProvider";
import type { Folder as FolderType, Task, SmartList } from "@/types";
```

- [ ] **Step 2: 在组件函数体顶部取 auth**

在 `Sidebar.tsx` 函数体内、`const [adding, setAdding] = useState(false);` 之前加入:
```tsx
  const { user, signOut } = useAuth();
  const email = user?.email ?? "";
  const initial = email ? email[0]!.toUpperCase() : "?";
```

- [ ] **Step 3: 替换账号底栏（原 156-164 行那个 `<div className="px-4 py-4 …">` 块）**

把写死的 "Alex Kim / Free Plan" 整块替换为:
```tsx
      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-full bg-accent/20 flex items-center justify-center text-xs font-semibold text-accent">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sidebar-foreground text-xs font-medium truncate">{email}</div>
            <button
              onClick={() => signOut()}
              className="mt-0.5 flex items-center gap-1 text-[#6B6B68] text-[11px] hover:text-sidebar-foreground transition-colors"
            >
              <LogOut size={11} /> Sign out
            </button>
          </div>
        </div>
      </div>
```

- [ ] **Step 4: 改 Layout 的 Onboarding key**

在 `src/routes/Layout.tsx`：
1. 顶部加 import：`import { useAuth } from "@/store/AuthProvider";`
2. 在 `const navigate = useNavigate();` 附近加：`const { user } = useAuth();`
3. 把
   ```tsx
   const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem("ff_onboarded"));
   ```
   改为：
   ```tsx
   const onboardKey = `ff_onboarded:${user?.id ?? "anon"}`;
   const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem(onboardKey));
   ```
4. 把 `dismissOnboarding` 里的
   ```tsx
   try { localStorage.setItem("ff_onboarded", "1"); } catch { /* ignore */ }
   ```
   改为：
   ```tsx
   try { localStorage.setItem(onboardKey, "1"); } catch { /* ignore */ }
   ```

- [ ] **Step 5: 类型检查 + 构建 + 测试**

Run（分开三条）:
```
npx tsc --noEmit
npm run build
npm test
```
Expected: tsc 仍只剩 2 个预存报错；build 成功；test 全绿。

- [ ] **Step 6: 提交**

```bash
git add src/features/sidebar/Sidebar.tsx src/routes/Layout.tsx
git commit -m "feat(auth): wire real account + sign out in sidebar, per-user onboarding"
```

---

## Task 6: 外部配置 + 手动端到端验证

> 这是一个**人工任务**：代码已完成，需在 Supabase / Google 控制台配置并在浏览器走查。无单测。

- [ ] **Step 1: Supabase 控制台 — Email provider**

Authentication → Providers → Email：确认开启。开发期把 **Confirm email** 关闭（这样注册即得 session，便于测试）。

- [ ] **Step 2: Supabase 控制台 — Google provider（可选，但本功能需要）**

Authentication → Providers → Google：
1. 在 Google Cloud Console 建 OAuth 2.0 Client ID（Web application）。
2. 把 Supabase 页面显示的 **Callback URL** 填入 Google 的 *Authorized redirect URIs*。
3. 把 Google 的 Client ID / Secret 填回 Supabase，保存启用。
> 不做这步邮箱密码仍可用；只有点 Google 按钮会报错。

- [ ] **Step 3: 确认 env**

确认 `.env.local` 含 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_PUBLISHABLE_KEY`（已存在）。

- [ ] **Step 4: 启动并走查**

Run: `npm run dev`
逐项确认：
1. 未登录访问 `/today` → 自动跳到 `/login`。
2. `/login` 输入非法邮箱 / 短密码 → 内联红字拦截，不发请求。
3. 切到 `/signup` 注册一个新邮箱 → 进入主应用，看到 4 张 Onboarding 引导卡。
4. 刷新页面 → 仍在主应用（会话保持，先闪一下 Loading splash）。
5. Sidebar 底栏显示刚注册的邮箱；点 **Sign out** → 回到 `/login`。
6. 用刚注册的账号在 `/login` 登录 → 回到 `/today`，引导卡不再出现（同一用户已看过）。
7. （若配了 Google）点 **Continue with Google** → 完成 Google 授权 → 回跳进入主应用。
8. 既有功能抽查：计时器、folder 增删、calendar、AI 面板均正常。

- [ ] **Step 5: 标记完成**

走查全过后，本功能完成。后续可用 `superpowers:finishing-a-development-branch` 决定合并方式。

---

## Self-Review 记录

- **Spec 覆盖**：§2 架构→T4；§3 文件全部落到 T1–T5；§4 行为流（会话保持 T1、登录跳转 T3/T4、注册确认提示 T3、Google T3、登出 T5）；§5 校验/错误→T3；§6 外部配置→T6；§7 测试→T1/T2/T3 的单测；§9 行为保持→T4 保留全部既有路由、T5 按用户区分引导。✅ 无遗漏。
- **占位符扫描**：无 TBD/TODO；所有代码步骤含完整代码。✅
- **类型一致性**：`useAuth` 返回的 `signIn`/`signUp`(返回含 `session`)/`signInWithGoogle`/`signOut`/`user`/`loading` 在 T1 定义，T3/T5 消费签名一致；`AuthForm` 的 `mode` 类型在 T3 内统一为 `"login" | "signup"`。✅
