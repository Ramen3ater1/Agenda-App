# Supabase 接入教程（Agenda）

> 目标：在 Supabase 建立和本 app 数据模型对应的表，开启认证，配置 **RLS（行级安全）**，让**每个用户只能读写自己的数据**。
>
> 全程照着勾选即可。SQL 全部可以直接复制到 Supabase 的 **SQL Editor** 运行。

---

## 0. 准备：心智模型

本 app 现在的数据全部存在 localStorage（`agenda:v1`）。我们要把它换成 Supabase Postgres。核心思路只有一句话：

> **每张业务表都加一列 `user_id`，并用 RLS 规定「只有 `user_id = 当前登录用户` 的行才能被访问」。**

`auth.uid()` 是 Supabase 在每次请求里自动注入的当前登录用户 ID。RLS 策略全靠它。

数据模型映射（对照 `src/types/index.ts`）：

| 代码类型      | Supabase 表       | 说明 |
|---------------|-------------------|------|
| `Folder`      | `folders`         | 任务分组 |
| `Task`        | `tasks`           | 任务主体 |
| `TaskStep`    | `task_steps`      | 任务的子步骤（一对多） |
| `Workspace`   | `workspaces`      | 工作区 |
| `Resource`    | `resources`       | 工作区里的链接/文件/笔记 |
| `WorkSession` | `work_sessions`   | 番茄钟/工作记录 |

> 💡 `steps` / `resources` / `sessions` 也可以塞进一个 `jsonb` 列（更接近你现在的 localStorage blob，迁移最省事）。本教程默认用**规范化的独立表**（更利于查询、统计、排序）。文末「附录 B」给出 jsonb 简化版。

---

## 1. 创建项目并拿到密钥

- [ ] 打开 https://supabase.com → **New project**，选区域（建议离你近的，如 `Northeast Asia (Tokyo)`）。
- [ ] 等待 1~2 分钟初始化完成。
- [ ] 进入 **Project Settings → API**，记下两个值：
  - `Project URL` → 例如 `https://xxxx.supabase.co`
  - `anon public` key（这是**前端用的公开 key**，配合 RLS 安全；不要用 `service_role` key 放前端！）

把它们写进项目根目录的 `.env`（Vite 要求 `VITE_` 前缀）：

```bash
# .env  —— 记得加入 .gitignore，别提交
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...（你的 anon key）
```

- [ ] 确认 `.env` 已在 `.gitignore` 中。

---

## 2. 开启认证（Auth）

RLS 依赖「登录用户」，所以先把 Auth 打开。

- [ ] **Authentication → Providers → Email**：保持开启（默认就是）。
- [ ] 本地开发想免去收邮件验证：**Authentication → Sign In / Providers → Email** 里把 **"Confirm email"** 暂时关掉（上线前再打开）。
- [ ] （可选）想要 Google/GitHub 登录，在同一页开对应 Provider 并填 OAuth 凭据。

> 之后用户注册成功，就会在 `auth.users` 表里出现一行，`auth.uid()` 即该用户的 UUID。

---

## 3. 建表 + 索引

打开 **SQL Editor → New query**，整段粘贴运行：

```sql
-- ⚠️ 开启 UUID 生成函数（Supabase 默认已装，保险起见）
create extension if not exists "pgcrypto";

-- ── folders ───────────────────────────────────────────────
create table public.folders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

-- ── tasks ─────────────────────────────────────────────────
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default '',
  description text not null default '',
  priority    text not null default 'medium'
              check (priority in ('critical','high','medium','low')),
  status      text not null default 'todo'
              check (status in ('todo','in-progress','done')),
  deadline    text not null default '',           -- 你现在存的是字符串日期，保持一致
  folder_id   uuid references public.folders(id) on delete set null,
  recurrence  text not null default 'none'
              check (recurrence in ('none','daily','weekly','monthly')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── task_steps ────────────────────────────────────────────
create table public.task_steps (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  task_id   uuid not null references public.tasks(id) on delete cascade,
  title     text not null default '',
  done      boolean not null default false,
  position  int not null default 0               -- 用于保持步骤顺序
);

-- ── workspaces ────────────────────────────────────────────
create table public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null default '',
  task_id    uuid references public.tasks(id) on delete set null,
  step_id    uuid references public.task_steps(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ── resources ─────────────────────────────────────────────
create table public.resources (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  type         text not null check (type in ('link','file','note')),
  title        text not null default '',
  value        text not null default ''
);

-- ── work_sessions ─────────────────────────────────────────
create table public.work_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  date         text not null default '',          -- 与代码里的 string 保持一致
  duration     int not null default 0,            -- 秒
  comment      text not null default '',
  created_at   timestamptz not null default now()
);

-- ── 索引（按 user_id / 外键查询会非常频繁）──────────────────
create index on public.folders       (user_id);
create index on public.tasks         (user_id);
create index on public.tasks         (folder_id);
create index on public.task_steps    (task_id);
create index on public.workspaces    (user_id);
create index on public.resources     (workspace_id);
create index on public.work_sessions (workspace_id);
```

- [ ] 运行成功，**Table Editor** 里能看到 6 张表。

> 📌 设计要点：每张表都直接带 `user_id`（即使能通过外键间接推出），因为这让 RLS 策略**简单且高效**——直接 `user_id = auth.uid()`，不用 JOIN。

---

## 4. 开启 RLS（关键一步）

**默认情况下，建好表后任何拥有 anon key 的人都能读写全部数据**。开启 RLS 后，没有匹配的策略 = 一律拒绝。所以必须先开 RLS，再写策略。

```sql
alter table public.folders       enable row level security;
alter table public.tasks         enable row level security;
alter table public.task_steps    enable row level security;
alter table public.workspaces    enable row level security;
alter table public.resources     enable row level security;
alter table public.work_sessions enable row level security;
```

- [ ] 运行后，每张表在 Table Editor 里会显示 🔒 **RLS enabled**。
- [ ] 此刻前端去查会**返回空**——正常，因为还没写策略。

---

## 5. 配置 RLS 策略

策略思路统一为：**当前登录用户只能操作自己的行**。下面给每张表配 4 类操作（SELECT / INSERT / UPDATE / DELETE）。

> - `using (...)`：决定**哪些已存在的行可见/可改/可删**。
> - `with check (...)`：决定**新写入/改完后的行是否合法**（防止把数据塞给别人的 user_id）。

整段粘贴运行：

```sql
-- 通用宏思路：user_id = auth.uid()
-- folders --------------------------------------------------
create policy "folders_select" on public.folders
  for select using (auth.uid() = user_id);
create policy "folders_insert" on public.folders
  for insert with check (auth.uid() = user_id);
create policy "folders_update" on public.folders
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "folders_delete" on public.folders
  for delete using (auth.uid() = user_id);

-- tasks ----------------------------------------------------
create policy "tasks_select" on public.tasks
  for select using (auth.uid() = user_id);
create policy "tasks_insert" on public.tasks
  for insert with check (auth.uid() = user_id);
create policy "tasks_update" on public.tasks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tasks_delete" on public.tasks
  for delete using (auth.uid() = user_id);

-- task_steps -----------------------------------------------
create policy "steps_select" on public.task_steps
  for select using (auth.uid() = user_id);
create policy "steps_insert" on public.task_steps
  for insert with check (auth.uid() = user_id);
create policy "steps_update" on public.task_steps
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "steps_delete" on public.task_steps
  for delete using (auth.uid() = user_id);

-- workspaces -----------------------------------------------
create policy "ws_select" on public.workspaces
  for select using (auth.uid() = user_id);
create policy "ws_insert" on public.workspaces
  for insert with check (auth.uid() = user_id);
create policy "ws_update" on public.workspaces
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ws_delete" on public.workspaces
  for delete using (auth.uid() = user_id);

-- resources ------------------------------------------------
create policy "res_select" on public.resources
  for select using (auth.uid() = user_id);
create policy "res_insert" on public.resources
  for insert with check (auth.uid() = user_id);
create policy "res_update" on public.resources
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "res_delete" on public.resources
  for delete using (auth.uid() = user_id);

-- work_sessions --------------------------------------------
create policy "sess_select" on public.work_sessions
  for select using (auth.uid() = user_id);
create policy "sess_insert" on public.work_sessions
  for insert with check (auth.uid() = user_id);
create policy "sess_update" on public.work_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sess_delete" on public.work_sessions
  for delete using (auth.uid() = user_id);
```

- [ ] 运行成功。**Authentication → Policies** 里能看到每张表各 4 条策略。

---

## 6. 自动填充 `user_id`（强烈推荐）

前端 insert 时不想每次手动带 `user_id`？用触发器在写入时自动补上当前用户：

```sql
create or replace function public.set_user_id()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

-- 给每张表挂触发器
create trigger set_uid_folders       before insert on public.folders
  for each row execute function public.set_user_id();
create trigger set_uid_tasks         before insert on public.tasks
  for each row execute function public.set_user_id();
create trigger set_uid_steps         before insert on public.task_steps
  for each row execute function public.set_user_id();
create trigger set_uid_workspaces    before insert on public.workspaces
  for each row execute function public.set_user_id();
create trigger set_uid_resources     before insert on public.resources
  for each row execute function public.set_user_id();
create trigger set_uid_sessions      before insert on public.work_sessions
  for each row execute function public.set_user_id();
```

之后前端 insert 一个 task 时，连 `user_id` 都不用传，数据库自动填。

---

## 7. 前端接线（Vite + React）

```bash
npm install @supabase/supabase-js
```

新建 `src/lib/supabase.ts`：

```ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
```

登录/注册（最小示例）：

```ts
// 注册
await supabase.auth.signUp({ email, password });
// 登录
await supabase.auth.signInWithPassword({ email, password });
// 当前用户
const { data: { user } } = await supabase.auth.getUser();
// 登出
await supabase.auth.signOut();
```

读写数据（RLS 自动过滤，无需手写 WHERE user_id）：

```ts
// 读自己的所有 task（自动只返回当前用户的行）
const { data: tasks } = await supabase
  .from("tasks")
  .select("*, task_steps(*)")     // 顺带把子步骤一起拉出来
  .order("created_at");

// 新建 task（user_id 由触发器自动填）
const { data, error } = await supabase
  .from("tasks")
  .insert({ title: "写教程", priority: "high", status: "todo" })
  .select()
  .single();

// 更新
await supabase.from("tasks").update({ status: "done" }).eq("id", taskId);

// 删除
await supabase.from("tasks").delete().eq("id", taskId);
```

> 在本 app 里，建议下一步把 `src/lib/storage.ts` 的 localStorage 读写换成上面这些调用，或者在 `TaskProvider` 里加一个「登录后从 Supabase 拉取、变更时回写」的同步层。这属于 Phase 3（后端接入），可以单独开分支做。

---

## 8. 验证 RLS 真的生效 ✅

这一步**别跳过**，是确认安全的唯一方法。

- [ ] **A. 自己能存能读**：在前端注册用户 A → 登录 → 新建一个 task → 刷新页面仍在 → 数据库 Table Editor 里能看到该行且 `user_id` = A 的 id。
- [ ] **B. 看不到别人的数据**：再注册用户 B → 登录 → 查 tasks → **应该是空的**（看不到 A 的 task）。
- [ ] **C. 改不动别人的数据**：用 B 的身份尝试 `update`/`delete` A 的 task id → 受影响行数为 0（RLS 拦截）。
- [ ] **D. 未登录拿不到数据**：登出后查 tasks → 返回空。

在 SQL Editor 里也可以模拟某个用户来测（把 UUID 换成真实用户 id）：

```sql
-- 模拟以某用户身份查询
select set_config('request.jwt.claims',
  json_build_object('sub','把这里换成用户A的uuid','role','authenticated')::text, true);
set role authenticated;
select * from public.tasks;   -- 只会看到用户A的行
reset role;
```

---

## 9. 上线前检查清单

- [ ] 所有 6 张表都 **RLS enabled**（没有任何一张漏开）。
- [ ] 前端只用了 **anon key**，`service_role` key 从未出现在客户端代码或 git 里。
- [ ] `.env` 在 `.gitignore` 中。
- [ ] Auth 的 **Confirm email** 在生产环境**重新打开**。
- [ ] 部署平台（Vercel 等）配置了 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 环境变量。

---

## 附录 A：常见坑

| 现象 | 原因 | 解决 |
|------|------|------|
| 前端查询永远返回 `[]` | RLS 开了但没写 select 策略，或用户未登录 | 检查第 5 步策略；确认 `auth.getUser()` 有值 |
| insert 报 `new row violates row-level security` | `with check` 不通过，通常是 `user_id` 没对上 | 用第 6 步触发器自动填，或 insert 时显式带 `user_id: user.id` |
| 改/删别人数据「成功」但没变化 | RLS 正常工作，受影响行数为 0 | 这是**正确行为** |
| 本地注册收不到验证邮件 | 默认要邮箱确认 | 开发期关掉 Confirm email（第 2 步） |

## 附录 B：极简 jsonb 方案（最接近现状）

如果你只想最快把现在的 localStorage blob 整体搬上云、暂时不做规范化查询，可以只建一张表：

```sql
create table public.app_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  state      jsonb not null default '{}'::jsonb,   -- 直接存整个 agenda:v1
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

create policy "state_select" on public.app_state
  for select using (auth.uid() = user_id);
create policy "state_upsert" on public.app_state
  for insert with check (auth.uid() = user_id);
create policy "state_update" on public.app_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

前端：

```ts
// 保存
await supabase.from("app_state")
  .upsert({ user_id: user.id, state: wholeAppState, updated_at: new Date() });
// 读取
const { data } = await supabase.from("app_state").select("state").single();
```

**优点**：迁移工作量最小，几乎是把 `localStorage.setItem` 换成 upsert。
**缺点**：无法在数据库层面查询「所有 high 优先级任务」、做统计或跨设备增量同步。建议作为过渡，长期仍走规范化的 A 方案。
```
