# 设计:任务数据持久化到 Supabase（第一期）

- **日期**：2026-06-24
- **状态**：已批准（待写实现计划）
- **方案**：A —— 规范化表 + 在线乐观同步层（套在现有 TaskProvider 上）

---

## 0. 背景与决策摘要

登录功能已上线（见 `2026-06-23-supabase-auth-login-design.md`），但任务数据仍存在 localStorage。本设计把数据迁到已建好的 Supabase 规范化表，实现**跨设备**持久化。

经 brainstorm 锁定的四个决策：

1. **同步目标**：跨设备同步（同账号换设备能看到同一份数据）。**不要**实时（Realtime）。
2. **分期**：仅做第一期 —— **在线乐观同步 + 离线只读缓存 + last-write-wins**。离线写队列 / 冲突合并留第二期。
3. **桥接方式**：方案 A —— 用规范化的 6 张表，写一个「嵌套 ↔ 拆表」映射层。
4. **id 类型**：实体 id 列改为 `text`，`uid()` 升级为 `crypto.randomUUID()`（详见 §2）。

应用内存模型（`DataState`）是嵌套的，而 DB 是规范化的，这层阻抗差是本设计的核心工作量：

| 应用内存（嵌套） | Supabase 表（规范化） |
|---|---|
| `Task.steps: TaskStep[]` | `task_steps`（FK task_id） |
| `Workspace.resources: Resource[]` | `resources`（FK workspace_id） |
| `Workspace.sessions: WorkSession[]` | `work_sessions`（FK workspace_id） |
| `Task.workspaceId` ↔ `Workspace.taskId` | 仅 `workspaces.task_id`，应用侧 `Task.workspaceId` 在装配时由它反推 |
| `DataState.gcalConnected` | 无对应表 → 保持 localStorage 本地（§4） |

---

## 1. 范围与边界

**做：**
- 登录后从 Supabase 拉取该用户的全部数据，装配成嵌套 `DataState` 初始化应用。
- 任意数据变更（14 个 reducer action 中涉及持久数据的）乐观写回 Supabase。
- 首次登录且云端为空时，把本地 localStorage 既有数据一次性迁移上云。
- localStorage 保留为**读缓存**：刷新/短暂断网仍能看到上次数据（只读）。
- 写失败的提示与有限重试。

**不做（YAGNI / 第二期）：**
- Supabase Realtime（多端秒级互推）。
- 离线写队列、删除墓碑、非 last-write-wins 的冲突合并。
- `gcalConnected` 上云。
- 字段级 diff 的精细写（本期用「子集合全删重插」的粗粒度写）。

---

## 2. 头号事项：id 类型对齐（必须先改表）

**问题**：`src/lib/utils.ts` 的 `uid()` 返回 `Math.random().toString(36).slice(2, 9)` —— 一个 7 位 base36 短字符串（如 `"k3j9f2a"`），不是 uuid。种子数据 id（`"t1"`/`"f1"`/`"ses1"` 等）同理。而已建表的所有实体 id 列是 `uuid` 类型 → 插入会因类型不符直接失败。

**决定**：
1. 把 6 张表的**实体 id 列**（`id` 以及 `folder_id` / `task_id` / `workspace_id` / `step_id` 这些指向实体的外键）从 `uuid` 改为 `text`。`user_id` **保持 `uuid`**（它是 `auth.users(id)` 的真外键，不动）。
2. 把 `uid()` 升级为 `crypto.randomUUID()`，新实体今后用标准 uuid（以 text 存储）。

`text` 列同时容纳新 uuid、旧短 id、种子短 id → **迁移零重映射**。表当前为空，直接 drop & recreate。

**§2 + §3 合并的 schema delta SQL（在 Supabase SQL Editor 重跑）**：

```sql
-- 删除旧表（空表，安全；CASCADE 连带策略/触发器/索引一起清掉）
drop table if exists public.work_sessions cascade;
drop table if exists public.resources     cascade;
drop table if exists public.workspaces    cascade;
drop table if exists public.task_steps    cascade;
drop table if exists public.tasks         cascade;
drop table if exists public.folders       cascade;

-- folders
create table public.folders (
  id         text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

-- tasks（新增 position 列，§3）
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

> 重跑表后，必须再重跑 `docs/supabase-setup.md` 的 **Step 4（enable RLS）+ Step 5（策略）+ Step 6（set_user_id 触发器）**，因为 drop cascade 把它们一并删了。

`docs/supabase-setup.md` 应同步更新为 text 版本，避免文档与实现脱节。

---

## 3. schema 小缺口

- **`tasks.position int`**（已含在 §2 SQL）：应用支持拖拽排序（`SET_TASK_ORDER`），但原表无顺序列。加上后顺序可按行同步；装配时 `order by position, created_at`。
- **`gcalConnected`**：无对应表，是「本设备是否连了 gcal」的本地标志 → 保持 localStorage，不上云。

---

## 4. 架构

在现有 `TaskProvider` 上加同步层，不推翻 useReducer 结构。

```
登录（useAuth 的 user 就绪）
  → fetchAllData(userId): 并行拉 6 表 → mappers 装配成嵌套 DataState
  → TaskProvider: localStorage 缓存先秒显 → 云数据到达后替换；期间 loading 态
变更（任意 reducer action）
  → syncedDispatch(action):
       const next = taskReducer(state, action)   // 复用纯 reducer 算结果
       dispatch(action)                          // 本地秒变
       void syncAction(action, next)             // 按受影响实体异步写 Supabase
```

### 新增文件
- **`src/lib/db/mappers.ts`** —— 行 ↔ 领域对象映射（snake_case ↔ camelCase；把扁平行装配成嵌套 `Task.steps` / `Workspace.resources` / `Workspace.sessions`；反推 `Task.workspaceId`）。纯函数。
- **`src/lib/db/sync.ts`** —— 同步层，按实体的 6 个函数（非 14 个 action 映射）：
  - `fetchAllData(userId): Promise<DataState>`
  - `upsertTask(task: Task): Promise<void>` —— upsert `tasks` 行（含 position）+ 该 task 的 `task_steps` 全删重插
  - `deleteTask(taskId, workspaceId?): Promise<void>` —— 删 `tasks`（级联删 steps）+ 若有关联 workspace 一并删
  - `upsertFolder(folder): Promise<void>`
  - `deleteFolder(folderId): Promise<void>`
  - `upsertWorkspace(ws: Workspace): Promise<void>` —— upsert `workspaces` + `resources` 全删重插 + `work_sessions` upsert
  - `syncAction(action: DataAction, next: DataState): Promise<void>` —— 按 action 类型分派到上面的实体函数（同步层的入口，供 TaskProvider 的包装 dispatch 调用）。
- **`src/lib/db/migrate.ts`** —— `migrateLocalToCloud(local: DataState, userId): Promise<void>`（见 §6）。
- **`src/features/auth/ImportLocalDataPrompt.tsx`** —— 一次性导入提示弹窗（见 §6）。

### 改动文件
- **`src/store/TaskProvider.tsx`** —— 从同步 `initDataState` 改为异步加载流程（§5）；把对外暴露的 `dispatch` 包装成 `syncedDispatch`；新增 `loading` 态。`useTasks`/`useFolders`/`useWorkspaces` **零改动**。
- **`src/lib/utils.ts`** —— `uid()` 改为 `crypto.randomUUID()`。
- **`docs/supabase-setup.md`** —— 表结构更新为 text id + position 版本。

---

## 5. 写路径：按实体 upsert（粗粒度）

`syncAction(action, next)` 按 action 找受影响实体并调用对应函数：

| action | 同步动作 |
|---|---|
| ADD_TASK / UPDATE_TASK / TOGGLE_TASK / RESET_RECURRING / APPLY_OPTIMIZATION | `upsertTask(next.tasks.find(受影响 id))` |
| SET_TASK_ORDER | 对 `action.ids` 涉及的 task 批量 `upsertTask`（写新 position） |
| DELETE_TASK | `deleteTask(id, 原 task.workspaceId)` |
| ADD_FOLDER / RENAME_FOLDER | `upsertFolder` |
| DELETE_FOLDER | `deleteFolder(id)`（DB 的 `on delete set null` 自动把 tasks.folder_id 置空，与 reducer 行为一致） |
| ENSURE_WORKSPACE / UPDATE_WORKSPACE / ADD_SESSION | `upsertWorkspace(next.workspaces.find(受影响 id))` |
| SET_GCAL | 仅本地，不同步 |

「子集合全删重插」对 steps/resources（每个仅数条）足够可靠且简单；`work_sessions` 用 upsert 保留历史。`upsertTask` 内对 `task_steps` 写入 `position = 数组下标`。

---

## 6. 新用户与迁移（opt-in，不静默）

**为什么不自动迁移**：现状下 `TaskProvider` 首次渲染就会 `saveState` 把**种子数据**也写进 localStorage，因此「localStorage 非空」并不能可靠区分"用户真实数据"与"被持久化的 demo 种子"。自动迁移会把 demo 数据塞进真实账号。故改为**让用户决定**。

`migrate.ts` 的 `migrateLocalToCloud`：把传入的 `DataState` 按 folders → tasks(+steps) → workspaces(+resources+sessions) 的外键顺序逐表写入（user_id 由触发器自动填）。

加载时的判定（TaskProvider）：

1. 云端**有数据** → 用云端（localStorage 退为缓存，忽略其内容）。
2. 云端**为空** 且 本地 localStorage **非空** → **从空开始**，同时弹出 `ImportLocalDataPrompt`：「检测到本设备有本地数据，导入到你的账号？[导入] [从空白开始]」。点导入 → 调 `migrateLocalToCloud(本地解析出的 DataState, userId)` 后刷新；点从空白 → 标记忽略，之后不再提示（localStorage key `agenda:import-dismissed:${userId}`）。
3. 云端为空 且 本地为空 → 直接从空 `DataState` 开始。

> 这样无论本地是真实数据还是被持久化的种子，都由用户一眼判断后决定，不会静默污染账号。

---

## 7. 错误处理（乐观，last-write-wins）

- 写失败 → `sonner` toast「保存失败，正在重试…」+ 自动重试 1 次。
- 仍失败 → 顶部挂一个「未同步」标记（轻量，复用现有 Toaster 或一个小 badge）。
- **不回滚**本地状态：乐观保留用户改动；下次对同一实体的写会重新带上最新值（last-write-wins 自然收敛）。
- 加载失败（fetchAllData 抛错）→ 回退到 localStorage 缓存 + toast 提示「离线，仅显示缓存」。
- ⚠️ 诚实边界：断网时失败的写**不保证**自动补传（离线队列是第二期）。

---

## 8. 测试（Vitest + jsdom，mock `@/lib/supabase`）

- **`mappers.ts`**（纯函数，重点覆盖）：行→领域装配出正确嵌套（steps/resources/sessions 归位、workspaceId 反推、position 排序）；领域→行拆解正确（snake_case、外键、position 下标）。
- **`sync.ts`**：每个 upsert/delete 对正确的表发出正确 payload（断言 mock 的 `.from(table).upsert/insert/delete/eq` 调用链）；`upsertTask` 确实「全删重插」task_steps。
- **`migrate.ts`**：`migrateLocalToCloud` 按 folders→tasks(+steps)→workspaces(+resources+sessions) 外键顺序写入。
- **`TaskProvider`**：异步加载（缓存先显、云数据替换、loading 收敛）；包装后的 dispatch 触发对应 `syncAction`（mock sync 层断言被调用）；既有 reducer 行为不回归；云空+本地非空 → 触发 `ImportLocalDataPrompt`，云有数据 → 不触发。

---

## 9. 行为保持契约

- 登录后所有现有功能（today/all/folder/calendar/task 详情、计时器、AI 面板、folder CRUD、拖拽排序）行为不变。
- `useTasks` / `useFolders` / `useWorkspaces` 的对外签名零改动。
- UI 仍秒回（乐观本地优先）。
- 唯一可见变化：数据现在跨设备；新真实账号从空开始（不再有 demo 种子）。
