# 设计：Supabase 邮箱密码 + Google 登录（方案 A）

- **日期**：2026-06-23
- **状态**：已批准（待写实现计划）
- **方案**：A —— AuthProvider（React Context）+ AuthGuard 路由守卫

---

## 1. 范围与边界

**本次只做「鉴权 + 门禁 + 登录 UI」**：

- 邮箱密码注册 / 登录
- Google OAuth 登录
- 登出
- 会话保持（刷新不掉登录）
- 未登录访问受保护页 → 重定向到登录页

**明确不在本次范围内：**

- 任务数据仍保留在 localStorage（`agenda:v1` 不动）。把业务数据真正搬上 Supabase（建表、RLS、读写改造）是独立的下一步（见 `docs/supabase-setup.md`），不在本设计内。
- 这样改动可控，可独立验证：本次完成后，登录流程能跑通，但用户的任务数据仍是本地的、跨设备不同步。

**登录后行为**：登录成功才看得到主应用；首次进入主应用仍弹现有的 4 张 Onboarding 引导卡。

---

## 2. 架构 —— 在现有嵌套里插入鉴权层

当前 `src/app/App.tsx` 的结构：

```
<ErrorBoundary>
  <BrowserRouter>
    <TaskProvider>
      <TimerProvider>
        <Routes>
          <Route element={<Layout/>}>
            today / all / folder/:id / calendar / task/:id
```

改造后：

```
<ErrorBoundary>
  <AuthProvider>                      ← 新增：持有 session，订阅 onAuthStateChange
    <BrowserRouter>
      <Routes>
        /login   → <LoginRoute>       ← 公开，无 Sidebar
        /signup  → <SignupRoute>      ← 公开，无 Sidebar
        <Route element={<AuthGuard/>}>             ← 新增门禁：未登录 → /login
          <Route element={<ProtectedProviders/>}>  ← TaskProvider + TimerProvider
            <Route element={<Layout/>}>            ← 现有 Sidebar + Outlet 原样
              index → Navigate /today
              today / all / folder/:id / calendar / task/:id   ← 全部不动
              * → Navigate /today
```

**关键收益**：`TaskProvider` 被挪进 `AuthGuard` 内侧 → **只有登录后才加载用户数据**，为下一步按 `user.id` 查 Supabase 铺好路。

`AuthProvider` 放在 `BrowserRouter` 外层即可——它不依赖路由；所有 `useAuth()` 消费者都在其内部。

---

## 3. 新增 / 改动文件

### 新增

| 文件 | 作用 |
|------|------|
| `src/store/AuthProvider.tsx` | Context：启动时 `getSession()` 恢复登录态 + 订阅 `onAuthStateChange`；暴露 `useAuth()`，返回 `{ user, loading, signIn, signUp, signInWithGoogle, signOut }` |
| `src/store/AuthProvider.test.tsx` | mock supabase，测会话恢复、方法转发、订阅清理 |
| `src/routes/AuthGuard.tsx` | `loading → <AuthSplash/>`；`无 user → <Navigate to="/login" replace state={{ from: location }}/>`；否则 `<Outlet/>` |
| `src/routes/ProtectedProviders.tsx` | 把 `<TaskProvider><TimerProvider><Outlet/></TimerProvider></TaskProvider>` 抽成一个元素，给 AuthGuard 的子路由用 |
| `src/routes/LoginRoute.tsx` | 薄壳：已登录则 `<Navigate to="/today"/>`，否则渲染 `<AuthForm mode="login"/>` |
| `src/routes/SignupRoute.tsx` | 薄壳：同上，渲染 `<AuthForm mode="signup"/>` |
| `src/features/auth/AuthCard.tsx` | 视觉外壳：居中卡片 + Agenda Logo（复用 Onboarding 的 Zap 方块 + Instrument Sans 字体 + 语义色） |
| `src/features/auth/AuthForm.tsx` | 表单本体，`mode: "login" \| "signup"`：邮箱/密码输入、Google 按钮、客户端校验、loading 态、内联错误提示、登录↔注册切换链接 |
| `src/features/auth/AuthSplash.tsx` | 会话恢复期的全屏占位（Logo + 转圈），避免登录态闪烁 |
| `src/features/auth/index.ts` | barrel 导出 |
| `src/features/auth/AuthForm.test.tsx` | 校验逻辑 + 提交调用对应方法 + 错误渲染 |

### 改动

| 文件 | 改动 |
|------|------|
| `src/app/App.tsx` | 插入第 2 节的嵌套结构（新增 `/login`、`/signup`、`AuthGuard`、`ProtectedProviders`） |
| `src/features/sidebar/Sidebar.tsx` | 底部新增极简「账号行」：显示登录邮箱 + 登出按钮（为了测通完整闭环） |
| `src/routes/Layout.tsx` | Onboarding 标记由全局 `ff_onboarded` 改为按用户 `ff_onboarded:${user.id}`，让不同用户各自看一次引导 |

---

## 4. 关键行为流

- **会话保持**：刷新页面 → `AuthProvider` 启动时 `supabase.auth.getSession()` 恢复 session → 不会被踢回登录页。恢复完成前显示 `<AuthSplash/>`。
- **登录成功**：`signIn(email, pw)` → `onAuthStateChange` 自动更新 session → `AuthGuard` 放行 → `navigate(from ?? "/today")`（`from` 来自被拦截时记录的来源页）。
- **注册**：
  - 开发期（关闭了 Confirm email）：`signUp` 直接拿到 session → 进主应用看引导卡。
  - 若开启邮箱验证：表单显示「请到邮箱点击确认链接」提示，不自动进入。
- **Google**：`signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } })` → 跳转 Google → 回跳后 `onAuthStateChange` 接管，正常进入主应用。
- **登出**：Sidebar 账号行 → `signOut()` → session 变为 null → `AuthGuard` 把用户送回 `/login`。

---

## 5. 校验与错误处理

- **客户端校验**：邮箱格式（基础正则）+ 密码长度 ≥ 6（Supabase 下限）。不通过则不发请求，直接内联提示。
- **服务端错误**：把 `error.message`（如 `Invalid login credentials`、`User already registered`）**内联**显示在表单下方红字。登录页不在 `Layout` 内，因此不用 sonner toast。
- **loading 态**：请求期间禁用提交按钮并显示转圈，防止重复提交。

---

## 6. 外部配置（前置步骤，写进实现计划但需用户在控制台手动完成）

1. Supabase → Authentication → Providers → **Email**：保持开启；开发期关闭 **Confirm email**。
2. Supabase → Authentication → Providers → **Google**：填入从 Google Cloud Console 申请的 OAuth Client ID / Secret。
3. Google Cloud Console：把 Supabase 提供的回调 URL 加入 **Authorized redirect URIs**。
4. 确认 `.env.local` 已含 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_PUBLISHABLE_KEY`（已存在）。

> 不配 Google 也不影响邮箱密码登录；只是 Google 按钮点击会报错。

---

## 7. 测试（Vitest，沿用现有 jsdom + @testing-library 配置）

- **AuthProvider**（mock `@/lib/supabase`）：`getSession` 返回会话后 `user` 正确暴露；`onAuthStateChange` 回调触发能更新 `user`；卸载时取消订阅。
- **AuthGuard**（`MemoryRouter`）：无 user 时渲染重定向到 `/login`；有 user 时渲染 `<Outlet/>` 内容；`loading` 时渲染 splash。
- **AuthForm**：空 / 非法邮箱 / 短密码被客户端拦截；合法输入调用对应的 `signIn` / `signUp` / `signInWithGoogle`；服务端错误信息被渲染。

---

## 8. 不做（YAGNI）

- 忘记密码 / 重置密码
- 修改密码 / 修改邮箱
- 邮箱验证落地页
- Google 之外的第三方 Provider
- 「记住我」选项 / 多因素认证（MFA）
- 用户资料页 / 头像上传

以上如需要，各自单独开 spec。

---

## 9. 行为保持契约

- 登录后，现有所有路由（today / all / folder / calendar / task）的行为与改造前完全一致。
- Onboarding 引导卡仍在首次进入主应用时显示（改为按用户区分）。
- 计时器、AI 面板、folder CRUD 等现有功能不受影响。
- 数据仍读写 localStorage，本次不改变持久化介质。
