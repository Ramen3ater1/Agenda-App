# Supabase 数据持久化（第一期）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把任务数据从 localStorage 迁到 Supabase 规范化表，实现跨设备持久化（在线乐观同步 + 离线只读缓存 + last-write-wins）。

**Architecture:** 在现有 `TaskProvider`（useReducer）外加一层同步：登录后 `fetchAllData` 拉 6 张表装配成嵌套 `DataState`；包装 dispatch，使每个 action 先本地秒变、再按受影响实体异步写 Supabase。`useTasks`/`useFolders`/`useWorkspaces` 零改动。

**Tech Stack:** React 18 + TS + Vite + @supabase/supabase-js v2 + Vitest 4 + @testing-library/react v16（含 `renderHook`）。

## Global Constraints

- react-router import 来自 `"react-router"`（非 react-router-dom）。
- `@` 别名 → `src`。
- 提交信息**不得**含任何 `Co-Authored-By` / Co-author 字样。
- Supabase 客户端在 `src/lib/supabase.ts`，导出 `supabase`。所有 DB 调用走它。
- **RLS 已开**：写入时 `user_id` 由 `set_user_id` 触发器自动填，读取由 RLS 自动按用户过滤。因此 `fetchAllData()` / 写函数**不需要** userId 参数（spec 文中提到的 userId 因触发器而省去）。
- 实体 id 列为 `text`（见前置 SQL）；`user_id` 仍为 `uuid`。
- 子集合用「全删重插」（steps、resources）；`work_sessions` 用 upsert 保留历史。
- 乐观更新：写失败不回滚本地状态。
- tsc 有 2 个预先存在的 `src/main.tsx` 报错，与本功能无关；门槛是「无新报错」，且 `npm run build`、`npm test` 通过。tsc/build/test 三条命令**分开**运行，勿用 `&&` 串联。
- 不留运行中的 dev server。

---

## 前置步骤（HUMAN，必须先做，否则全部写操作会失败）

在 Supabase SQL Editor 重跑 spec §2 的 schema delta（drop & recreate 6 表为 **text id + `tasks.position`**），**然后**重跑 `docs/supabase-setup.md` 的 Step 4（enable RLS）+ Step 5（策略）+ Step 6（`set_user_id` 触发器）——因为 `drop ... cascade` 把它们一并删了。完成后每张表应显示 🔒 RLS enabled。

> 实现任务（代码）可以先写、单测可以先过（都 mock supabase），但**手动端到端验证（Task 8）前必须完成本前置步骤**。

---

## File Structure

**新增**
- `src/lib/db/mappers.ts`（+ `mappers.test.ts`）— 行 ↔ 领域对象映射 + 嵌套装配（纯函数）
- `src/lib/db/sync.ts`（+ `sync.test.ts`）— `fetchAllData` + 6 个实体写函数 + `syncAction`
- `src/lib/db/migrate.ts`（+ `migrate.test.ts`）— `migrateLocalToCloud`
- `src/features/auth/ImportLocalDataPrompt.tsx` — 一次性导入弹窗

**改动**
- `src/lib/utils.ts` — `uid()` → `crypto.randomUUID()`
- `src/store/taskReducer.ts` — 加 `REPLACE_ALL` action；`initDataState` 改为「缓存或空」（去掉 INIT 种子）
- `src/store/TaskProvider.tsx` — 异步加载 + 包装 dispatch + 导入弹窗 wiring
- `docs/supabase-setup.md` — 表结构更新为 text id + position 版本

---

## Task 1: Foundation — uuid 化、REPLACE_ALL、空初始化

**Files:**
- Modify: `src/lib/utils.ts`（`uid`）
- Modify: `src/store/taskReducer.ts`（加 `REPLACE_ALL`，改 `initDataState`）
- Test: `src/store/taskReducer.test.ts`（加 REPLACE_ALL 用例）

**Interfaces:**
- Produces:
  - `uid(): string` 现在返回标准 uuid（`crypto.randomUUID()`）。
  - `DataAction` 新增成员 `{ type: "REPLACE_ALL"; state: DataState }`。
  - `taskReducer(state, { type: "REPLACE_ALL", state })` 返回该 `state`。
  - `initDataState(): DataState` 返回 `loadState() ?? { tasks: [], folders: [], workspaces: [], gcalConnected: false }`（不再注入 INIT 种子）。

- [ ] **Step 1: 写失败的测试（REPLACE_ALL）**

在 `src/store/taskReducer.test.ts` 末尾追加：
```ts
it("REPLACE_ALL swaps the whole state", () => {
  const replacement: DataState = {
    tasks: [{ id: "tz", title: "Z", description: "", priority: "low", status: "todo", deadline: "2026-07-01", steps: [], recurrence: "none" }],
    folders: [{ id: "fz", name: "Zed" }],
    workspaces: [],
    gcalConnected: true,
  };
  const s = taskReducer(base(), { type: "REPLACE_ALL", state: replacement });
  expect(s).toEqual(replacement);
});
```
确认顶部已 `import type { DataState } from "@/store/taskReducer";`（若没有则补：`import { taskReducer, type DataState } from "@/store/taskReducer";` 与现有 import 合并）。

- [ ] **Step 2: 运行确认失败**

Run: `npm test -- src/store/taskReducer.test.ts`
Expected: FAIL —— `REPLACE_ALL` 不是已知 action 类型 / 结果不等。

- [ ] **Step 3: 实现**

在 `src/store/taskReducer.ts`：

1. `DataAction` 联合类型中加一行：
```ts
  | { type: "REPLACE_ALL"; state: DataState }
```
2. `switch` 中（`default` 之前）加：
```ts
    case "REPLACE_ALL":
      return action.state;
```
3. 改 `initDataState` 与顶部 import：把
```ts
import { INIT_TASKS, INIT_FOLDERS, INIT_WORKSPACES } from "@/constants";
```
整行删除，并把
```ts
export function initDataState(): DataState {
  const persisted: PersistedState | null = loadState();
  if (persisted) return persisted;
  return { tasks: INIT_TASKS, folders: INIT_FOLDERS, workspaces: INIT_WORKSPACES, gcalConnected: false };
}
```
改为：
```ts
export function initDataState(): DataState {
  return loadState() ?? { tasks: [], folders: [], workspaces: [], gcalConnected: false };
}
```

- [ ] **Step 4: 改 `uid()`**

在 `src/lib/utils.ts` 把
```ts
export function uid() {
  return Math.random().toString(36).slice(2, 9);
}
```
改为：
```ts
export function uid() {
  return crypto.randomUUID();
}
```

- [ ] **Step 5: 运行全量测试 + 类型检查**

Run（分开）：
```
npm test
npx tsc --noEmit
```
Expected: 测试全绿（含新 REPLACE_ALL 用例）；tsc 只剩 2 个预存 main.tsx 报错，无新报错（特别确认 `@/constants` 的 INIT 导入移除后 taskReducer 无未用 import 报错）。

- [ ] **Step 6: 提交**

```bash
git add src/lib/utils.ts src/store/taskReducer.ts src/store/taskReducer.test.ts
git commit -m "feat(data): uuid ids, REPLACE_ALL action, empty default state"
```

---

## Task 2: mappers —— 行 ↔ 领域映射与嵌套装配

**Files:**
- Create: `src/lib/db/mappers.ts`
- Test: `src/lib/db/mappers.test.ts`

**Interfaces:**
- Consumes: 领域类型 `Task/TaskStep/Folder/Workspace/Resource/WorkSession` from `@/types`；`DataState` from `@/store/taskReducer`。
- Produces（全部具名导出）：
  - 行类型：`FolderRow, TaskRow, TaskStepRow, WorkspaceRow, ResourceRow, WorkSessionRow`
  - `RawRows = { folders: FolderRow[]; tasks: TaskRow[]; taskSteps: TaskStepRow[]; workspaces: WorkspaceRow[]; resources: ResourceRow[]; workSessions: WorkSessionRow[] }`
  - `assembleDataState(rows: RawRows): DataState`（`gcalConnected` 置 `false`，由调用方另行处理）
  - `taskToRow(task: Task, position: number): TaskRow`
  - `stepToRow(step: TaskStep, taskId: string, position: number): TaskStepRow`
  - `folderToRow(folder: Folder): FolderRow`
  - `workspaceToRow(ws: Workspace): WorkspaceRow`
  - `resourceToRow(res: Resource, workspaceId: string): ResourceRow`
  - `sessionToRow(sess: WorkSession, workspaceId: string): WorkSessionRow`

- [ ] **Step 1: 写失败的测试**

`src/lib/db/mappers.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  assembleDataState, taskToRow, stepToRow, folderToRow,
  workspaceToRow, resourceToRow, sessionToRow, type RawRows,
} from "@/lib/db/mappers";

const raw: RawRows = {
  folders: [{ id: "f1", name: "Work" }],
  tasks: [
    { id: "t2", title: "Second", description: "", priority: "low", status: "todo", deadline: "", folder_id: null, recurrence: "none", position: 1 },
    { id: "t1", title: "First", description: "d", priority: "high", status: "todo", deadline: "2026-07-01", folder_id: "f1", recurrence: "daily", position: 0 },
  ],
  taskSteps: [
    { id: "s2", task_id: "t1", title: "b", done: true, position: 1 },
    { id: "s1", task_id: "t1", title: "a", done: false, position: 0 },
  ],
  workspaces: [{ id: "w1", name: "WS", task_id: "t1", step_id: null }],
  resources: [{ id: "r1", workspace_id: "w1", type: "link", title: "L", value: "u" }],
  workSessions: [{ id: "se1", workspace_id: "w1", date: "2026-06-20", duration: 60, comment: "c" }],
};

describe("assembleDataState", () => {
  it("orders tasks by position and nests steps in order", () => {
    const s = assembleDataState(raw);
    expect(s.tasks.map(t => t.id)).toEqual(["t1", "t2"]);
    expect(s.tasks[0].steps.map(st => st.id)).toEqual(["s1", "s2"]);
    expect(s.tasks[0].folderId).toBe("f1");
    expect(s.tasks[1].folderId).toBeUndefined();
  });
  it("reverse-links workspaceId onto its task", () => {
    const s = assembleDataState(raw);
    expect(s.tasks.find(t => t.id === "t1")!.workspaceId).toBe("w1");
  });
  it("nests resources and sessions into the workspace", () => {
    const s = assembleDataState(raw);
    const w = s.workspaces[0];
    expect(w.taskId).toBe("t1");
    expect(w.resources.map(r => r.id)).toEqual(["r1"]);
    expect(w.sessions.map(x => x.id)).toEqual(["se1"]);
  });
});

describe("domain → row", () => {
  it("taskToRow flattens folderId→folder_id and carries position", () => {
    const row = taskToRow(
      { id: "t1", title: "T", description: "", priority: "medium", status: "todo", deadline: "", steps: [], recurrence: "none" },
      3,
    );
    expect(row).toMatchObject({ id: "t1", folder_id: null, position: 3, priority: "medium" });
    expect(typeof row.updated_at).toBe("string");
  });
  it("stepToRow / resourceToRow / sessionToRow attach parent id and position", () => {
    expect(stepToRow({ id: "s1", title: "a", done: false }, "t1", 2)).toEqual({ id: "s1", task_id: "t1", title: "a", done: false, position: 2 });
    expect(resourceToRow({ id: "r1", type: "note", title: "n", value: "v" }, "w1")).toEqual({ id: "r1", workspace_id: "w1", type: "note", title: "n", value: "v" });
    expect(sessionToRow({ id: "se1", date: "d", duration: 5, comment: "c" }, "w1")).toEqual({ id: "se1", workspace_id: "w1", date: "d", duration: 5, comment: "c" });
  });
  it("folderToRow / workspaceToRow map ids", () => {
    expect(folderToRow({ id: "f1", name: "F" })).toEqual({ id: "f1", name: "F" });
    expect(workspaceToRow({ id: "w1", name: "W", taskId: "t1", resources: [], sessions: [] })).toEqual({ id: "w1", name: "W", task_id: "t1", step_id: null });
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test -- src/lib/db/mappers.test.ts`
Expected: FAIL —— `@/lib/db/mappers` 不存在。

- [ ] **Step 3: 实现**

`src/lib/db/mappers.ts`:
```ts
import type { Task, TaskStep, Folder, Workspace, Resource, WorkSession, Priority, TaskStatus, RecurrenceType, ResourceType } from "@/types";
import type { DataState } from "@/store/taskReducer";

export interface FolderRow { id: string; name: string }
export interface TaskRow {
  id: string; title: string; description: string;
  priority: Priority; status: TaskStatus; deadline: string;
  folder_id: string | null; recurrence: RecurrenceType; position: number; updated_at: string;
}
export interface TaskStepRow { id: string; task_id: string; title: string; done: boolean; position: number }
export interface WorkspaceRow { id: string; name: string; task_id: string | null; step_id: string | null }
export interface ResourceRow { id: string; workspace_id: string; type: ResourceType; title: string; value: string }
export interface WorkSessionRow { id: string; workspace_id: string; date: string; duration: number; comment: string }

export interface RawRows {
  folders: FolderRow[]; tasks: TaskRow[]; taskSteps: TaskStepRow[];
  workspaces: WorkspaceRow[]; resources: ResourceRow[]; workSessions: WorkSessionRow[];
}

function stepFromRow(r: TaskStepRow): TaskStep { return { id: r.id, title: r.title, done: r.done }; }
function resFromRow(r: ResourceRow): Resource { return { id: r.id, type: r.type, title: r.title, value: r.value }; }
function sessFromRow(r: WorkSessionRow): WorkSession { return { id: r.id, date: r.date, duration: r.duration, comment: r.comment }; }

export function assembleDataState(rows: RawRows): DataState {
  const byPos = (a: { position: number }, b: { position: number }) => a.position - b.position;

  const workspaces: Workspace[] = rows.workspaces.map(w => ({
    id: w.id,
    name: w.name,
    taskId: w.task_id ?? undefined,
    stepId: w.step_id ?? undefined,
    resources: rows.resources.filter(r => r.workspace_id === w.id).map(resFromRow),
    sessions: rows.workSessions.filter(s => s.workspace_id === w.id).map(sessFromRow),
  }));

  const tasks: Task[] = [...rows.tasks].sort(byPos).map(t => ({
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    status: t.status,
    deadline: t.deadline,
    folderId: t.folder_id ?? undefined,
    workspaceId: rows.workspaces.find(w => w.task_id === t.id)?.id,
    recurrence: t.recurrence,
    steps: rows.taskSteps.filter(s => s.task_id === t.id).sort(byPos).map(stepFromRow),
  }));

  const folders: Folder[] = rows.folders.map(f => ({ id: f.id, name: f.name }));

  return { tasks, folders, workspaces, gcalConnected: false };
}

export function taskToRow(task: Task, position: number): TaskRow {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    deadline: task.deadline,
    folder_id: task.folderId ?? null,
    recurrence: task.recurrence,
    position,
    updated_at: new Date().toISOString(),
  };
}
export function stepToRow(step: TaskStep, taskId: string, position: number): TaskStepRow {
  return { id: step.id, task_id: taskId, title: step.title, done: step.done, position };
}
export function folderToRow(folder: Folder): FolderRow {
  return { id: folder.id, name: folder.name };
}
export function workspaceToRow(ws: Workspace): WorkspaceRow {
  return { id: ws.id, name: ws.name, task_id: ws.taskId ?? null, step_id: ws.stepId ?? null };
}
export function resourceToRow(res: Resource, workspaceId: string): ResourceRow {
  return { id: res.id, workspace_id: workspaceId, type: res.type, title: res.title, value: res.value };
}
export function sessionToRow(sess: WorkSession, workspaceId: string): WorkSessionRow {
  return { id: sess.id, workspace_id: workspaceId, date: sess.date, duration: sess.duration, comment: sess.comment };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npm test -- src/lib/db/mappers.test.ts`
Expected: PASS（全部用例）。

- [ ] **Step 5: 提交**

```bash
git add src/lib/db/mappers.ts src/lib/db/mappers.test.ts
git commit -m "feat(data): add row<->domain mappers and nested assembly"
```

---

## Task 3: sync —— 拉取、按实体写、syncAction 分派

**Files:**
- Create: `src/lib/db/sync.ts`
- Test: `src/lib/db/sync.test.ts`

**Interfaces:**
- Consumes: `supabase` from `@/lib/supabase`；mappers（Task 2）；`DataState`、`DataAction` from `@/store/taskReducer`。
- Produces（具名导出）：
  - `fetchAllData(): Promise<DataState>`
  - `upsertTask(task: Task, position: number): Promise<void>`
  - `deleteTask(taskId: string, workspaceId?: string): Promise<void>`
  - `upsertFolder(folder: Folder): Promise<void>`
  - `deleteFolder(folderId: string): Promise<void>`
  - `upsertWorkspace(ws: Workspace): Promise<void>`
  - `syncAction(action: DataAction, prev: DataState, next: DataState): Promise<void>`

- [ ] **Step 1: 写失败的测试**

`src/lib/db/sync.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { fetchAllData, upsertTask, deleteTask, upsertFolder, deleteFolder, upsertWorkspace, syncAction } from "@/lib/db/sync";
import { supabase } from "@/lib/supabase";
import type { DataState } from "@/store/taskReducer";

// chainable mock: from(table) returns an object whose methods record calls and resolve.
const calls: { table: string; op: string; payload?: unknown; eqCol?: string; eqVal?: unknown }[] = [];

function makeChain(table: string) {
  const chain: Record<string, unknown> = {};
  const rec = (op: string, payload?: unknown, eqCol?: string, eqVal?: unknown) =>
    calls.push({ table, op, payload, eqCol, eqVal });
  chain.upsert = (p: unknown) => { rec("upsert", p); return Promise.resolve({ error: null }); };
  chain.insert = (p: unknown) => { rec("insert", p); return Promise.resolve({ error: null }); };
  chain.delete = () => ({ eq: (c: string, v: unknown) => { rec("delete", undefined, c, v); return Promise.resolve({ error: null }); } });
  chain.select = () => Promise.resolve({ data: [], error: null });
  return chain;
}

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }));

beforeEach(() => {
  calls.length = 0;
  (supabase.from as Mock).mockImplementation((t: string) => makeChain(t));
});

const sampleTask = { id: "t1", title: "T", description: "", priority: "medium" as const, status: "todo" as const, deadline: "", steps: [{ id: "s1", title: "a", done: false }], recurrence: "none" as const };

describe("entity writes", () => {
  it("upsertTask upserts the task row then replaces its steps", async () => {
    await upsertTask(sampleTask, 0);
    expect(calls.find(c => c.table === "tasks" && c.op === "upsert")).toBeTruthy();
    expect(calls.find(c => c.table === "task_steps" && c.op === "delete" && c.eqCol === "task_id" && c.eqVal === "t1")).toBeTruthy();
    expect(calls.find(c => c.table === "task_steps" && c.op === "insert")).toBeTruthy();
  });
  it("upsertTask with no steps does not insert steps", async () => {
    await upsertTask({ ...sampleTask, steps: [] }, 0);
    expect(calls.find(c => c.table === "task_steps" && c.op === "insert")).toBeFalsy();
  });
  it("deleteTask deletes workspace (if any) then the task", async () => {
    await deleteTask("t1", "w1");
    expect(calls.find(c => c.table === "workspaces" && c.op === "delete" && c.eqVal === "w1")).toBeTruthy();
    expect(calls.find(c => c.table === "tasks" && c.op === "delete" && c.eqVal === "t1")).toBeTruthy();
  });
  it("upsertFolder / deleteFolder hit folders", async () => {
    await upsertFolder({ id: "f1", name: "F" });
    await deleteFolder("f1");
    expect(calls.find(c => c.table === "folders" && c.op === "upsert")).toBeTruthy();
    expect(calls.find(c => c.table === "folders" && c.op === "delete" && c.eqVal === "f1")).toBeTruthy();
  });
  it("upsertWorkspace upserts workspace, replaces resources, upserts sessions", async () => {
    await upsertWorkspace({ id: "w1", name: "W", taskId: "t1", resources: [{ id: "r1", type: "link", title: "x", value: "y" }], sessions: [{ id: "se1", date: "d", duration: 1, comment: "c" }] });
    expect(calls.find(c => c.table === "workspaces" && c.op === "upsert")).toBeTruthy();
    expect(calls.find(c => c.table === "resources" && c.op === "delete" && c.eqVal === "w1")).toBeTruthy();
    expect(calls.find(c => c.table === "resources" && c.op === "insert")).toBeTruthy();
    expect(calls.find(c => c.table === "work_sessions" && c.op === "upsert")).toBeTruthy();
  });
});

describe("fetchAllData", () => {
  it("queries all six tables and returns a DataState", async () => {
    const s = await fetchAllData();
    expect((supabase.from as Mock).mock.calls.map(c => c[0]).sort()).toEqual(
      ["folders", "resources", "task_steps", "tasks", "work_sessions", "workspaces"],
    );
    expect(s).toEqual({ tasks: [], folders: [], workspaces: [], gcalConnected: false });
  });
});

describe("syncAction", () => {
  const empty: DataState = { tasks: [], folders: [], workspaces: [], gcalConnected: false };
  it("ADD_TASK → upsertTask on the new task", async () => {
    const next: DataState = { ...empty, tasks: [sampleTask] };
    await syncAction({ type: "ADD_TASK", task: sampleTask }, empty, next);
    expect(calls.find(c => c.table === "tasks" && c.op === "upsert")).toBeTruthy();
  });
  it("DELETE_TASK → deleteTask with the previous task's workspaceId", async () => {
    const prev: DataState = { ...empty, tasks: [{ ...sampleTask, workspaceId: "w9" }] };
    await syncAction({ type: "DELETE_TASK", id: "t1" }, prev, empty);
    expect(calls.find(c => c.table === "workspaces" && c.op === "delete" && c.eqVal === "w9")).toBeTruthy();
    expect(calls.find(c => c.table === "tasks" && c.op === "delete" && c.eqVal === "t1")).toBeTruthy();
  });
  it("SET_GCAL → no DB calls", async () => {
    await syncAction({ type: "SET_GCAL", connected: true }, empty, empty);
    expect(calls.length).toBe(0);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test -- src/lib/db/sync.test.ts`
Expected: FAIL —— `@/lib/db/sync` 不存在。

- [ ] **Step 3: 实现**

`src/lib/db/sync.ts`:
```ts
import { supabase } from "@/lib/supabase";
import type { Task, Folder, Workspace } from "@/types";
import type { DataState, DataAction } from "@/store/taskReducer";
import {
  assembleDataState, taskToRow, stepToRow, folderToRow,
  workspaceToRow, resourceToRow, sessionToRow,
  type FolderRow, type TaskRow, type TaskStepRow, type WorkspaceRow, type ResourceRow, type WorkSessionRow,
} from "@/lib/db/mappers";

export async function fetchAllData(): Promise<DataState> {
  const [folders, tasks, taskSteps, workspaces, resources, workSessions] = await Promise.all([
    supabase.from("folders").select("*"),
    supabase.from("tasks").select("*"),
    supabase.from("task_steps").select("*"),
    supabase.from("workspaces").select("*"),
    supabase.from("resources").select("*"),
    supabase.from("work_sessions").select("*"),
  ]);
  return assembleDataState({
    folders: (folders.data ?? []) as FolderRow[],
    tasks: (tasks.data ?? []) as TaskRow[],
    taskSteps: (taskSteps.data ?? []) as TaskStepRow[],
    workspaces: (workspaces.data ?? []) as WorkspaceRow[],
    resources: (resources.data ?? []) as ResourceRow[],
    workSessions: (workSessions.data ?? []) as WorkSessionRow[],
  });
}

export async function upsertTask(task: Task, position: number): Promise<void> {
  await supabase.from("tasks").upsert(taskToRow(task, position));
  await supabase.from("task_steps").delete().eq("task_id", task.id);
  if (task.steps.length) {
    await supabase.from("task_steps").insert(task.steps.map((s, i) => stepToRow(s, task.id, i)));
  }
}

export async function deleteTask(taskId: string, workspaceId?: string): Promise<void> {
  if (workspaceId) await supabase.from("workspaces").delete().eq("id", workspaceId);
  await supabase.from("tasks").delete().eq("id", taskId);
}

export async function upsertFolder(folder: Folder): Promise<void> {
  await supabase.from("folders").upsert(folderToRow(folder));
}

export async function deleteFolder(folderId: string): Promise<void> {
  await supabase.from("folders").delete().eq("id", folderId);
}

export async function upsertWorkspace(ws: Workspace): Promise<void> {
  await supabase.from("workspaces").upsert(workspaceToRow(ws));
  await supabase.from("resources").delete().eq("workspace_id", ws.id);
  if (ws.resources.length) {
    await supabase.from("resources").insert(ws.resources.map(r => resourceToRow(r, ws.id)));
  }
  if (ws.sessions.length) {
    await supabase.from("work_sessions").upsert(ws.sessions.map(s => sessionToRow(s, ws.id)));
  }
}

export async function syncAction(action: DataAction, prev: DataState, next: DataState): Promise<void> {
  switch (action.type) {
    case "ADD_TASK":
    case "UPDATE_TASK":
    case "TOGGLE_TASK":
    case "RESET_RECURRING":
    case "APPLY_OPTIMIZATION": {
      const id = action.type === "ADD_TASK" ? action.task.id
        : action.type === "APPLY_OPTIMIZATION" ? action.taskId
        : action.id;
      const idx = next.tasks.findIndex(t => t.id === id);
      if (idx >= 0) await upsertTask(next.tasks[idx], idx);
      return;
    }
    case "SET_TASK_ORDER": {
      await Promise.all(action.ids.map(id => {
        const idx = next.tasks.findIndex(t => t.id === id);
        return idx >= 0 ? upsertTask(next.tasks[idx], idx) : Promise.resolve();
      }));
      return;
    }
    case "DELETE_TASK": {
      const task = prev.tasks.find(t => t.id === action.id);
      await deleteTask(action.id, task?.workspaceId);
      return;
    }
    case "ADD_FOLDER":
      await upsertFolder(action.folder);
      return;
    case "RENAME_FOLDER": {
      const f = next.folders.find(x => x.id === action.id);
      if (f) await upsertFolder(f);
      return;
    }
    case "DELETE_FOLDER":
      await deleteFolder(action.id);
      return;
    case "ENSURE_WORKSPACE":
    case "UPDATE_WORKSPACE":
    case "ADD_SESSION": {
      const id = action.type === "ENSURE_WORKSPACE" ? action.workspace.id
        : action.type === "ADD_SESSION" ? action.workspaceId
        : action.id;
      const ws = next.workspaces.find(w => w.id === id);
      if (ws) await upsertWorkspace(ws);
      return;
    }
    case "SET_GCAL":
    case "REPLACE_ALL":
    default:
      return;
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npm test -- src/lib/db/sync.test.ts`
Expected: PASS（全部用例）。

- [ ] **Step 5: 提交**

```bash
git add src/lib/db/sync.ts src/lib/db/sync.test.ts
git commit -m "feat(data): add supabase sync layer (fetch, entity writes, syncAction)"
```

---

## Task 4: migrate —— 本地数据一次性上云

**Files:**
- Create: `src/lib/db/migrate.ts`
- Test: `src/lib/db/migrate.test.ts`

**Interfaces:**
- Consumes: `supabase`；mappers（Task 2）；`DataState`。
- Produces: `migrateLocalToCloud(local: DataState): Promise<void>` —— 按 folders → tasks(+steps) → workspaces(+resources+sessions) 的外键顺序，用 `insert` 写入（云端为空场景）。

- [ ] **Step 1: 写失败的测试**

`src/lib/db/migrate.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { migrateLocalToCloud } from "@/lib/db/migrate";
import { supabase } from "@/lib/supabase";
import type { DataState } from "@/store/taskReducer";

const inserted: string[] = [];
vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }));

beforeEach(() => {
  inserted.length = 0;
  (supabase.from as Mock).mockImplementation((t: string) => ({
    insert: (_p: unknown) => { inserted.push(t); return Promise.resolve({ error: null }); },
  }));
});

const local: DataState = {
  folders: [{ id: "f1", name: "F" }],
  tasks: [{ id: "t1", title: "T", description: "", priority: "low", status: "todo", deadline: "", steps: [{ id: "s1", title: "a", done: false }], folderId: "f1", recurrence: "none" }],
  workspaces: [{ id: "w1", name: "W", taskId: "t1", resources: [{ id: "r1", type: "link", title: "x", value: "y" }], sessions: [{ id: "se1", date: "d", duration: 1, comment: "c" }] }],
  gcalConnected: false,
};

describe("migrateLocalToCloud", () => {
  it("writes tables in FK-safe order", async () => {
    await migrateLocalToCloud(local);
    expect(inserted.indexOf("folders")).toBeLessThan(inserted.indexOf("tasks"));
    expect(inserted.indexOf("tasks")).toBeLessThan(inserted.indexOf("task_steps"));
    expect(inserted.indexOf("task_steps")).toBeLessThan(inserted.indexOf("workspaces"));
    expect(inserted.indexOf("workspaces")).toBeLessThan(inserted.indexOf("resources"));
    expect(inserted.indexOf("workspaces")).toBeLessThan(inserted.indexOf("work_sessions"));
  });
  it("skips empty collections", async () => {
    await migrateLocalToCloud({ tasks: [], folders: [], workspaces: [], gcalConnected: false });
    expect(inserted.length).toBe(0);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test -- src/lib/db/migrate.test.ts`
Expected: FAIL —— `@/lib/db/migrate` 不存在。

- [ ] **Step 3: 实现**

`src/lib/db/migrate.ts`:
```ts
import { supabase } from "@/lib/supabase";
import type { DataState } from "@/store/taskReducer";
import { taskToRow, stepToRow, folderToRow, workspaceToRow, resourceToRow, sessionToRow } from "@/lib/db/mappers";

export async function migrateLocalToCloud(local: DataState): Promise<void> {
  if (local.folders.length) {
    await supabase.from("folders").insert(local.folders.map(folderToRow));
  }
  if (local.tasks.length) {
    await supabase.from("tasks").insert(local.tasks.map((t, i) => taskToRow(t, i)));
    const steps = local.tasks.flatMap(t => t.steps.map((s, i) => stepToRow(s, t.id, i)));
    if (steps.length) await supabase.from("task_steps").insert(steps);
  }
  if (local.workspaces.length) {
    await supabase.from("workspaces").insert(local.workspaces.map(workspaceToRow));
    const resources = local.workspaces.flatMap(w => w.resources.map(r => resourceToRow(r, w.id)));
    if (resources.length) await supabase.from("resources").insert(resources);
    const sessions = local.workspaces.flatMap(w => w.sessions.map(s => sessionToRow(s, w.id)));
    if (sessions.length) await supabase.from("work_sessions").insert(sessions);
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npm test -- src/lib/db/migrate.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/lib/db/migrate.ts src/lib/db/migrate.test.ts
git commit -m "feat(data): add one-time local->cloud migration"
```

---

## Task 5: ImportLocalDataPrompt 弹窗

**Files:**
- Create: `src/features/auth/ImportLocalDataPrompt.tsx`
- Test: `src/features/auth/ImportLocalDataPrompt.test.tsx`

**Interfaces:**
- Consumes: 无（纯展示 + 回调）。
- Produces: 默认导出 `ImportLocalDataPrompt({ onImport, onDismiss }: { onImport: () => void; onDismiss: () => void })` —— 居中卡片，两个按钮「导入到我的账号」`onImport` / 「从空白开始」`onDismiss`。

- [ ] **Step 1: 写失败的测试**

`src/features/auth/ImportLocalDataPrompt.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ImportLocalDataPrompt from "@/features/auth/ImportLocalDataPrompt";

describe("ImportLocalDataPrompt", () => {
  it("fires onImport and onDismiss from the two buttons", () => {
    const onImport = vi.fn();
    const onDismiss = vi.fn();
    render(<ImportLocalDataPrompt onImport={onImport} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: /导入/ }));
    expect(onImport).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /空白/ }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test -- src/features/auth/ImportLocalDataPrompt.test.tsx`
Expected: FAIL —— 模块不存在。

- [ ] **Step 3: 实现**

`src/features/auth/ImportLocalDataPrompt.tsx`:
```tsx
export default function ImportLocalDataPrompt({
  onImport, onDismiss,
}: { onImport: () => void; onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-6" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
      <div className="w-full max-w-[380px] rounded-xl bg-card border border-border p-6 shadow-2xl">
        <h2 className="text-lg font-semibold tracking-tight mb-1.5">导入本地数据？</h2>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          检测到本设备有未同步的本地数据。要把它导入到你的账号（跨设备可见），还是从空白开始？
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onImport}
            className="w-full px-4 py-2.5 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            导入到我的账号
          </button>
          <button
            onClick={onDismiss}
            className="w-full px-4 py-2.5 rounded-md border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            从空白开始
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npm test -- src/features/auth/ImportLocalDataPrompt.test.tsx`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/features/auth/ImportLocalDataPrompt.tsx src/features/auth/ImportLocalDataPrompt.test.tsx
git commit -m "feat(data): add import-local-data prompt"
```

---

## Task 6: TaskProvider 集成 —— 异步加载 + 同步写 + 导入 wiring

**Files:**
- Modify: `src/store/TaskProvider.tsx`（整文件替换，见下）
- Test: `src/store/TaskProvider.test.tsx`

**Interfaces:**
- Consumes: `useAuth`（`@/store/AuthProvider`）；`fetchAllData`/`syncAction`（Task 3）；`migrateLocalToCloud`（Task 4）；`ImportLocalDataPrompt`（Task 5）；`taskReducer`/`initDataState`/`REPLACE_ALL`（Task 1）；`loadState`/`saveState`（`@/lib/storage`）。
- Produces: `TaskProvider` 与 `useTaskStore`（签名不变：`useTaskStore(): { state, dispatch }`，其中 `dispatch` 现在是会同步到云的包装版）。

- [ ] **Step 1: 写失败的测试**

`src/store/TaskProvider.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { TaskProvider, useTaskStore } from "@/store/TaskProvider";
import { fetchAllData, syncAction } from "@/lib/db/sync";
import { useAuth } from "@/store/AuthProvider";
import type { DataState } from "@/store/taskReducer";

vi.mock("@/store/AuthProvider", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/db/sync", () => ({ fetchAllData: vi.fn(), syncAction: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/db/migrate", () => ({ migrateLocalToCloud: vi.fn().mockResolvedValue(undefined) }));

function Probe() {
  const { state, dispatch } = useTaskStore();
  return (
    <div>
      <span data-testid="folders">{state.folders.map(f => f.name).join(",")}</span>
      <button onClick={() => dispatch({ type: "ADD_FOLDER", folder: { id: "fx", name: "New" } })}>add</button>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  (useAuth as Mock).mockReturnValue({ user: { id: "u1" } });
});

const cloud: DataState = { tasks: [], folders: [{ id: "f9", name: "Cloud" }], workspaces: [], gcalConnected: false };

describe("TaskProvider cloud integration", () => {
  it("loads cloud data and replaces local state", async () => {
    (fetchAllData as Mock).mockResolvedValue(cloud);
    render(<TaskProvider><Probe /></TaskProvider>);
    await waitFor(() => expect(screen.getByTestId("folders").textContent).toBe("Cloud"));
  });

  it("wrapped dispatch updates state and calls syncAction", async () => {
    (fetchAllData as Mock).mockResolvedValue(cloud);
    render(<TaskProvider><Probe /></TaskProvider>);
    await waitFor(() => expect(screen.getByTestId("folders").textContent).toBe("Cloud"));
    fireEvent.click(screen.getByRole("button", { name: "add" }));
    await waitFor(() => expect(screen.getByTestId("folders").textContent).toContain("New"));
    expect(syncAction).toHaveBeenCalled();
  });

  it("shows import prompt when cloud empty and localStorage non-empty", async () => {
    localStorage.setItem("agenda:v1", JSON.stringify({ tasks: [], folders: [{ id: "fl", name: "Local" }], workspaces: [], gcalConnected: false }));
    (fetchAllData as Mock).mockResolvedValue({ tasks: [], folders: [], workspaces: [], gcalConnected: false });
    render(<TaskProvider><Probe /></TaskProvider>);
    await waitFor(() => expect(screen.getByText("导入本地数据？")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test -- src/store/TaskProvider.test.tsx`
Expected: FAIL —— 现有 TaskProvider 无云加载/导入弹窗逻辑。

- [ ] **Step 3: 实现（整文件替换）**

`src/store/TaskProvider.tsx`:
```tsx
import {
  createContext, useContext, useEffect, useReducer, useRef, useState, useCallback,
  type ReactNode, type Dispatch,
} from "react";
import { toast } from "sonner";
import { taskReducer, initDataState, type DataState, type DataAction } from "@/store/taskReducer";
import { loadState, saveState } from "@/lib/storage";
import { useAuth } from "@/store/AuthProvider";
import { fetchAllData, syncAction } from "@/lib/db/sync";
import { migrateLocalToCloud } from "@/lib/db/migrate";
import ImportLocalDataPrompt from "@/features/auth/ImportLocalDataPrompt";

interface TaskStore {
  state: DataState;
  dispatch: Dispatch<DataAction>;
}

const EMPTY: DataState = { tasks: [], folders: [], workspaces: [], gcalConnected: false };
const TaskContext = createContext<TaskStore | null>(null);

function isEmptyState(s: DataState): boolean {
  return s.tasks.length === 0 && s.folders.length === 0 && s.workspaces.length === 0;
}

export function TaskProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, rawDispatch] = useReducer(taskReducer, undefined, initDataState); // cache-first
  const [showImport, setShowImport] = useState(false);

  // keep a ref so the wrapped dispatch can read current state without re-creating
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // write-through local cache (offline read cache)
  useEffect(() => { saveState(state); }, [state]);

  // load cloud data on login
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const cloud = await fetchAllData();
        if (cancelled) return;
        if (!isEmptyState(cloud)) {
          rawDispatch({ type: "REPLACE_ALL", state: { ...cloud, gcalConnected: loadState()?.gcalConnected ?? false } });
        } else {
          const local = loadState();
          const localNonEmpty = !!local && !isEmptyState(local);
          const dismissed = localStorage.getItem(`agenda:import-dismissed:${user.id}`);
          rawDispatch({ type: "REPLACE_ALL", state: { ...EMPTY, gcalConnected: local?.gcalConnected ?? false } });
          if (localNonEmpty && !dismissed) setShowImport(true);
        }
      } catch {
        if (!cancelled) toast.error("离线，仅显示缓存");
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const dispatch = useCallback<Dispatch<DataAction>>((action) => {
    const prev = stateRef.current;
    const next = taskReducer(prev, action);
    rawDispatch(action);
    void syncAction(action, prev, next).catch(() => {
      toast.error("保存失败，正在重试…");
      void syncAction(action, prev, next).catch(() => toast.error("仍未同步，请检查网络"));
    });
  }, []);

  function onImport() {
    const local = loadState();
    setShowImport(false);
    if (!local) return;
    void migrateLocalToCloud(local)
      .then(() => fetchAllData())
      .then(cloud => rawDispatch({ type: "REPLACE_ALL", state: { ...cloud, gcalConnected: local.gcalConnected } }))
      .catch(() => toast.error("导入失败，请重试"));
  }

  function onDismiss() {
    if (user) localStorage.setItem(`agenda:import-dismissed:${user.id}`, "1");
    setShowImport(false);
  }

  return (
    <TaskContext.Provider value={{ state, dispatch }}>
      {children}
      {showImport && <ImportLocalDataPrompt onImport={onImport} onDismiss={onDismiss} />}
    </TaskContext.Provider>
  );
}

export function useTaskStore(): TaskStore {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error("useTaskStore must be used within TaskProvider");
  return ctx;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npm test -- src/store/TaskProvider.test.tsx`
Expected: PASS（3 个用例）。

- [ ] **Step 5: 全量测试 + 类型检查 + 构建**

Run（分开）：
```
npm test
npx tsc --noEmit
npm run build
```
Expected: 测试全绿；tsc 只剩 2 个预存 main.tsx 报错；构建成功。

- [ ] **Step 6: 提交**

```bash
git add src/store/TaskProvider.tsx src/store/TaskProvider.test.tsx
git commit -m "feat(data): wire TaskProvider to supabase load + optimistic sync + import prompt"
```

---

## Task 7: 更新 docs/supabase-setup.md 为 text 版

**Files:**
- Modify: `docs/supabase-setup.md`

**Interfaces:** 无代码接口（文档）。

- [ ] **Step 1: 更新建表 SQL**

把 `docs/supabase-setup.md` 第 3 节（建表）的 6 张表 DDL 中**实体 id 列**由 `uuid ... default gen_random_uuid()` 改为 `text`（`id text primary key`），所有 `*_id` 指向实体的外键改为 `text`，`user_id` 保持 `uuid`。给 `tasks` 增加 `position int not null default 0`。其余（RLS、策略、触发器 Step 4–6）保持不变，但在第 3 节顶部加一句备注：

```markdown
> ⚠️ 实体 id 列用 `text`（不是 uuid），因为应用用 `crypto.randomUUID()` 生成 id 并在客户端插入；`user_id` 仍是 `auth.users` 的 uuid 外键。`tasks.position` 用于跨设备保持手动排序。
```

- [ ] **Step 2: 校对一致性**

肉眼确认文档 DDL 与 `docs/superpowers/specs/2026-06-24-supabase-data-persistence-design.md` §2 的 SQL 完全一致（列名、类型、check、position、索引）。

- [ ] **Step 3: 提交**

```bash
git add docs/supabase-setup.md
git commit -m "docs: update supabase schema to text ids + tasks.position"
```

---

## Task 8: 外部前置 + 手动端到端验证（HUMAN）

> 人工任务，无单测。需先完成顶部「前置步骤」（重跑 text schema + RLS/策略/触发器）。

- [ ] **Step 1: 确认 schema 已是 text 版且 RLS 已开**（前置步骤）。
- [ ] **Step 2: `npm run dev`，登录，走查：**
  1. 新账号（云端空、无本地数据）→ 进应用是**空列表**（无 demo 种子）。
  2. 新建 folder / task / step、改优先级、完成任务、拖拽排序 → UI 秒变；刷新页面后仍在（来自云端）。
  3. 在 Supabase Table Editor 看到对应行，且 `user_id` = 当前用户、`tasks.position` 随排序更新。
  4. 退出登录、换账号 B → 看不到 A 的数据；B 自己的改动独立。
  5. 计时器跑一会儿切换任务 → `work_sessions` 出现自动保存的 session。
  6. 若该浏览器此前有本地数据：首次登录弹「导入本地数据？」→ 点导入 → 数据上云;或点从空白 → 之后不再提示。
  7. 断网刷新 → 显示缓存 + 「离线」提示（只读）。
- [ ] **Step 3: 走查全过后，本期完成**，可用 `superpowers:finishing-a-development-branch` 整合。

---

## Self-Review 记录

- **Spec 覆盖**：§0/§2 id→text + uuid()（T1 + 前置 SQL + T7）；§3 position/gcal 本地（T1 mappers position、T6 gcal 保留）；§4 架构（T6）；§5 写路径（T3 syncAction 表）；§6 opt-in 迁移（T4 + T5 + T6 弹窗逻辑 + dismissed key）；§7 错误处理（T6 toast + 重试 1 次 + 离线回退）；§8 测试（T2–T6 单测）；§9 行为保持（hooks 零改动、乐观秒回）。✅
- **占位符扫描**：无 TBD/TODO；每个代码步骤含完整代码。✅
- **类型一致性**：mappers 的导出（assembleDataState/各 *ToRow/RawRows/行类型）在 T3 import 一致；`syncAction(action, prev, next)`、`upsertTask(task, position)`、`fetchAllData()`、`migrateLocalToCloud(local)` 在 T6 调用签名一致；`REPLACE_ALL` 在 T1 定义、T3 default 跳过、T6 使用一致。✅
- **已知取舍**：`fetchAllData`/`migrateLocalToCloud` 不带 userId（RLS+触发器使其多余），与 spec 文字的轻微差异已在 Global Constraints 注明。
