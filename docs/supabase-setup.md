# Supabase 数据库配置

本文档记录 Agenda 应用在 Supabase 上的数据库 schema 和初始化步骤。

---

## Step 1: 创建 Supabase 项目

1. 登录 [supabase.com](https://supabase.com)
2. 创建新项目（或使用已有项目）
3. 获取 `PROJECT_URL` 和 `ANON_KEY`，写入 `.env.local`：
   ```
   NEXT_PUBLIC_SUPABASE_URL=<PROJECT_URL>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
   ```

---

## Step 2: 启用 Auth

1. 在 Supabase 控制台，选择 **Authentication**
2. 配置 **Providers**：
   - Email/Password: 启用
   - Google OAuth: 配置 Client ID/Secret（从 Google Cloud Console 获取）
3. 记录回调地址，用于 OAuth redirect

---

## Step 3: 建表

> ⚠️ 实体 id 列用 `text`（不是 uuid），因为应用用 `crypto.randomUUID()` 生成 id 并在客户端插入；`user_id` 仍是 `auth.users` 的 uuid 外键。`tasks.position` 用于跨设备保持手动排序。

在 Supabase SQL Editor 中按顺序执行以下 SQL：

### 删除旧表（如有）

```sql
drop table if exists public.work_sessions cascade;
drop table if exists public.resources     cascade;
drop table if exists public.workspaces    cascade;
drop table if exists public.task_steps    cascade;
drop table if exists public.tasks         cascade;
drop table if exists public.folders       cascade;
```

### 创建新表

```sql
-- folders
create table public.folders (
  id         text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

-- tasks（新增 position 列）
create table public.tasks (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default '',
  description text not null default '',
  priority    text not null default 'medium' check (priority in ('critical','high','medium','low')),
  status      text not null default 'todo'    check (status in ('todo','in-progress','done')),
  deadline    text not null default '',
  folder_id   text references public.folders(id) on delete set null,
  recurrence  text not null default 'none'    check (recurrence in ('none','daily','weekly','monthly')),
  position    int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- task_steps
create table public.task_steps (
  id       text primary key,
  user_id  uuid not null references auth.users(id) on delete cascade,
  task_id  text not null references public.tasks(id) on delete cascade,
  title    text not null default '',
  done     boolean not null default false,
  position int not null default 0
);

-- workspaces
create table public.workspaces (
  id         text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null default '',
  task_id    text references public.tasks(id) on delete set null,
  step_id    text references public.task_steps(id) on delete set null,
  created_at timestamptz not null default now()
);

-- resources
create table public.resources (
  id           text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  type         text not null check (type in ('link','file','note')),
  title        text not null default '',
  value        text not null default ''
);

-- work_sessions
create table public.work_sessions (
  id           text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  date         text not null default '',
  duration     int not null default 0,
  comment      text not null default '',
  created_at   timestamptz not null default now()
);

-- 索引
create index on public.folders       (user_id);
create index on public.tasks         (user_id);
create index on public.tasks         (folder_id);
create index on public.task_steps    (task_id);
create index on public.workspaces    (user_id);
create index on public.resources     (workspace_id);
create index on public.work_sessions (workspace_id);
```

---

## Step 4: 启用 RLS（Row Level Security）

在 SQL Editor 中执行：

```sql
-- 启用所有表的 RLS
alter table public.folders       enable row level security;
alter table public.tasks         enable row level security;
alter table public.task_steps    enable row level security;
alter table public.workspaces    enable row level security;
alter table public.resources     enable row level security;
alter table public.work_sessions enable row level security;
```

---

## Step 5: 创建 RLS 策略

在 SQL Editor 中执行：

```sql
-- folders: 用户只能看/改自己的
create policy "users_can_view_own_folders" on public.folders
  for select using (auth.uid() = user_id);

create policy "users_can_insert_folders" on public.folders
  for insert with check (auth.uid() = user_id);

create policy "users_can_update_folders" on public.folders
  for update using (auth.uid() = user_id);

create policy "users_can_delete_folders" on public.folders
  for delete using (auth.uid() = user_id);

-- tasks
create policy "users_can_view_own_tasks" on public.tasks
  for select using (auth.uid() = user_id);

create policy "users_can_insert_tasks" on public.tasks
  for insert with check (auth.uid() = user_id);

create policy "users_can_update_tasks" on public.tasks
  for update using (auth.uid() = user_id);

create policy "users_can_delete_tasks" on public.tasks
  for delete using (auth.uid() = user_id);

-- task_steps
create policy "users_can_view_own_task_steps" on public.task_steps
  for select using (auth.uid() = user_id);

create policy "users_can_insert_task_steps" on public.task_steps
  for insert with check (auth.uid() = user_id);

create policy "users_can_update_task_steps" on public.task_steps
  for update using (auth.uid() = user_id);

create policy "users_can_delete_task_steps" on public.task_steps
  for delete using (auth.uid() = user_id);

-- workspaces
create policy "users_can_view_own_workspaces" on public.workspaces
  for select using (auth.uid() = user_id);

create policy "users_can_insert_workspaces" on public.workspaces
  for insert with check (auth.uid() = user_id);

create policy "users_can_update_workspaces" on public.workspaces
  for update using (auth.uid() = user_id);

create policy "users_can_delete_workspaces" on public.workspaces
  for delete using (auth.uid() = user_id);

-- resources
create policy "users_can_view_own_resources" on public.resources
  for select using (auth.uid() = user_id);

create policy "users_can_insert_resources" on public.resources
  for insert with check (auth.uid() = user_id);

create policy "users_can_update_resources" on public.resources
  for update using (auth.uid() = user_id);

create policy "users_can_delete_resources" on public.resources
  for delete using (auth.uid() = user_id);

-- work_sessions
create policy "users_can_view_own_work_sessions" on public.work_sessions
  for select using (auth.uid() = user_id);

create policy "users_can_insert_work_sessions" on public.work_sessions
  for insert with check (auth.uid() = user_id);

create policy "users_can_update_work_sessions" on public.work_sessions
  for update using (auth.uid() = user_id);

create policy "users_can_delete_work_sessions" on public.work_sessions
  for delete using (auth.uid() = user_id);
```

---

## Step 6: 创建 set_user_id 触发器

在 SQL Editor 中执行：

```sql
-- 创建函数用于自动填充 user_id
create or replace function public.set_user_id()
returns trigger
language plpgsql
as $$
begin
  new.user_id := auth.uid();
  return new;
end;
$$;

-- 为所有表添加触发器
create trigger set_user_id_folders
before insert on public.folders
for each row
execute function public.set_user_id();

create trigger set_user_id_tasks
before insert on public.tasks
for each row
execute function public.set_user_id();

create trigger set_user_id_task_steps
before insert on public.task_steps
for each row
execute function public.set_user_id();

create trigger set_user_id_workspaces
before insert on public.workspaces
for each row
execute function public.set_user_id();

create trigger set_user_id_resources
before insert on public.resources
for each row
execute function public.set_user_id();

create trigger set_user_id_work_sessions
before insert on public.work_sessions
for each row
execute function public.set_user_id();
```

---

## 验证

完成上述步骤后，验证：

1. 在 Supabase 控制台的 **Table Editor** 中，确认所有 6 张表已创建
2. 在 **SQL Editor** 中运行 `\d public.tasks` 等命令验证列定义
3. 本地测试登录和数据读写

---

## 参考

- [Supabase 官方文档](https://supabase.com/docs)
- [Agenda 数据持久化设计](./superpowers/specs/2026-06-24-supabase-data-persistence-design.md)
