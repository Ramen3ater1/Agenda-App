# Agenda Phase 1 重构地基 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 1821 行单文件 `src/app/App.tsx` 重构为分层的(types/constants/lib/store/hooks/features/routes)、用 `useReducer`+Context 管理状态、用 react-router v7 路由、localStorage 持久化、有 Vitest 安全网的前端,不改变可见 UI(除"今天"改用真实日期)。

**Architecture:** 纯数据流向单一 `taskReducer`(纯函数);`TaskProvider` 持久化它;`TimerProvider` 嵌套其内管理瞬时计时并向数据 store 派发会话;`hooks/` 层做 action creators + 跨切面副作用(重复任务重置、计时结束)编排;`features/` 是纯展示组件,通过 hooks 取数据;`routes/` 把 URL 参数接到 features;`app/App.tsx` 只装配 ErrorBoundary + Router + Providers + Routes。

**Tech Stack:** React 18, TypeScript, Vite 6, Tailwind v4, react-router 7.17, Vitest, sonner, motion, lucide-react。`@` → `src` 别名已配置。

**关键事实(实现时牢记):**
- 路由 import 一律来自 `"react-router"`(v7,非 `react-router-dom`,后者未安装)。
- `react-dom` 18.3.1 已装,但 `package.json` 把 react/react-dom 放在 `peerDependencies`(Make 约定)。不要移动它们。
- 现有源码全部在 `src/app/App.tsx`,行号引用以当前文件为准(共 1821 行)。
- shadcn 组件在 `src/app/components/ui/`,Phase 1 不动。
- 含 JSX 的常量(`ONBOARDING_SLIDES`)必须放 `.tsx` 文件;不含 JSX 的(`PLAN_TEMPLATE`、`PRIORITY_CFG`、种子数据)放 `.ts`。

---

## File Structure

**新建:**
- `src/types/index.ts` — 全部类型
- `src/constants/index.ts` — `PRIORITY_CFG`、`RECURRENCE_LABELS`、`INIT_FOLDERS/WORKSPACES/TASKS`、`GCAL_EVENTS`、`PLAN_TEMPLATE`(无 JSX 常量)
- `src/lib/utils.ts` — `cn`、`uid`、`today`、`todayISO`、`formatDate`、`formatDuration`、`daysLeft`、`daysInMonth`、`firstDayOfMonth`、`advanceDeadline`、`completeRecurringTask`、`createWorkSession`、`generateOptimizations`、`sortTasks`、`isTodayTask`、`selectListTasks`
- `src/lib/utils.test.ts` — 纯逻辑单测
- `src/lib/storage.ts` — `loadState/saveState/loadTimer/saveTimer`
- `src/lib/storage.test.ts`
- `src/store/taskReducer.ts` — `DataState`、`DataAction`、`taskReducer`、`initDataState`
- `src/store/taskReducer.test.ts`
- `src/store/TaskProvider.tsx` — provider + 持久化 + `useTaskStore`
- `src/store/TimerProvider.tsx` — 计时 context + `useTimer`
- `src/hooks/useTasks.ts`、`useFolders.ts`、`useWorkspaces.ts`
- `src/components/ErrorBoundary.tsx`
- `src/features/{sidebar,task-list,task-detail,calendar,ai-optimize,ai-plan,end-session,onboarding}/<Comp>.tsx` + 每个目录 `index.ts`
- `src/routes/Layout.tsx`、`ListRoute.tsx`、`CalendarRoute.tsx`、`TaskRoute.tsx`
- `vitest.config.ts`

**修改:**
- `src/app/App.tsx` — 缩减为装配层(≤100 行)
- `src/main.tsx` — 不变(仍 import `./app/App.tsx`),确认即可
- `package.json` — 加 Vitest devDeps + `test` 脚本

---

## Task 1: 工具链 — Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/smoke.test.ts`(临时)

- [ ] **Step 1: 安装 Vitest devDeps**

Run:
```bash
npm install -D vitest@^2 jsdom@^25 @testing-library/react@^16 @testing-library/jest-dom@^6
```
Expected: 安装成功,无 peer 冲突报错(警告可忽略)。

- [ ] **Step 2: 加 test 脚本**

在 `package.json` 的 `"scripts"` 中加入(保留现有 `build`/`dev`):
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: 写 `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```

- [ ] **Step 4: 写临时 smoke 测试**

`src/lib/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: 跑测试确认工具链可用**

Run: `npm test`
Expected: PASS, 1 passed。

- [ ] **Step 6: 删除 smoke 测试并提交**

```bash
rm src/lib/smoke.test.ts
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add Vitest test runner"
```

---

## Task 2: 提取 types

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: 创建 `src/types/index.ts`**

把 `src/app/App.tsx` 第 16–95 行的全部类型原样搬入,并对每个加 `export`。完整内容:
```ts
export type Priority = "critical" | "high" | "medium" | "low";
export type TaskStatus = "todo" | "in-progress" | "done";
export type SmartList = "today" | "all" | "calendar";
export type ResourceType = "link" | "file" | "note";
export type RecurrenceType = "none" | "daily" | "weekly" | "monthly";

export interface TaskStep {
  id: string;
  title: string;
  done: boolean;
}

export interface Folder {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  deadline: string;
  steps: TaskStep[];
  folderId?: string;
  workspaceId?: string;
  recurrence: RecurrenceType;
}

export interface Resource {
  id: string;
  type: ResourceType;
  title: string;
  value: string;
}

export interface WorkSession {
  id: string;
  date: string;
  duration: number;
  comment: string;
}

export interface Workspace {
  id: string;
  name: string;
  taskId?: string;
  stepId?: string;
  resources: Resource[];
  sessions: WorkSession[];
}

export interface GCalEvent {
  id: string;
  title: string;
  date: string;
  time: string;
}

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  context?: string;
  timeline: string;
  status: "pending" | "accepted" | "removed";
  refined?: boolean;
}

export interface OptimizeSuggestion {
  id: string;
  title: string;
  description: string;
  tag: string;
  taskId: string;
  field: string;
  value: unknown;
  status: "pending" | "accepted" | "rejected";
}
```

- [ ] **Step 2: 提交**

```bash
git add src/types/index.ts
git commit -m "refactor: extract types to src/types"
```

> 注:此刻 `App.tsx` 仍有自己的类型副本,尚未删除——保证每一步可独立编译。旧副本在 Task 15 随组件迁移一并清除。

---

## Task 3: 提取 constants(无 JSX)

**Files:**
- Create: `src/constants/index.ts`

- [ ] **Step 1: 创建 `src/constants/index.ts`**

搬入 `App.tsx` 中的 `PRIORITY_CFG`(99–104)、`RECURRENCE_LABELS`(106–111)、`INIT_FOLDERS`(115–119)、`INIT_WORKSPACES`(121–158)、`INIT_TASKS`(160–221)、`GCAL_EVENTS`(223–230)、`PLAN_TEMPLATE`(232–268),全部加 `export`,顶部加类型 import。文件骨架:
```ts
import type { Priority, RecurrenceType, Folder, Workspace, Task, GCalEvent, PlanStep } from "@/types";

export const PRIORITY_CFG: Record<Priority, { label: string; color: string; dot: string; bg: string; border: string }> = {
  // …原样照搬 App.tsx 第 100–103 行四行…
};

export const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  // …原样照搬 App.tsx 第 107–110 行…
};

export const INIT_FOLDERS: Folder[] = [ /* App.tsx 116–118 */ ];
export const INIT_WORKSPACES: Workspace[] = [ /* App.tsx 122–157 */ ];
export const INIT_TASKS: Task[] = [ /* App.tsx 161–220 */ ];
export const GCAL_EVENTS: GCalEvent[] = [ /* App.tsx 224–229 */ ];
export const PLAN_TEMPLATE: PlanStep[] = [ /* App.tsx 233–267 */ ];
```
**注意:** `PLAN_TEMPLATE` 各项的 `status: "pending"` 字面量保持不变。`ONBOARDING_SLIDES` 含 JSX,**不**放这里——它在 Task 14 随 OnboardingOverlay 进 `.tsx`。

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无新错误(旧 `App.tsx` 仍编译通过)。

- [ ] **Step 3: 提交**

```bash
git add src/constants/index.ts
git commit -m "refactor: extract constants and seed data"
```

---

## Task 4: lib/utils — 日期与格式化(TDD)

**Files:**
- Create: `src/lib/utils.ts`
- Test: `src/lib/utils.test.ts`

- [ ] **Step 1: 写失败测试**

`src/lib/utils.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  uid, todayISO, formatDate, formatDuration, daysLeft,
  daysInMonth, firstDayOfMonth, advanceDeadline,
} from "@/lib/utils";

describe("uid", () => {
  it("returns a non-empty string and is reasonably unique", () => {
    const a = uid();
    const b = uid();
    expect(typeof a).toBe("string");
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});

describe("formatDuration", () => {
  it("formats seconds as HH:MM:SS", () => {
    expect(formatDuration(0)).toBe("00:00:00");
    expect(formatDuration(8100)).toBe("02:15:00");
    expect(formatDuration(59)).toBe("00:00:59");
  });
});

describe("formatDate", () => {
  it("short mode → 'Jun 20'", () => {
    expect(formatDate("2026-06-20", "short")).toBe("Jun 20");
  });
  it("session mode → includes weekday", () => {
    expect(formatDate("2026-06-20", "session")).toBe("Sat, Jun 20");
  });
});

describe("advanceDeadline", () => {
  it("daily adds one day", () => {
    expect(advanceDeadline("2026-06-20", "daily")).toBe("2026-06-21");
  });
  it("weekly adds seven days", () => {
    expect(advanceDeadline("2026-06-20", "weekly")).toBe("2026-06-27");
  });
  it("monthly adds one month", () => {
    expect(advanceDeadline("2026-06-20", "monthly")).toBe("2026-07-20");
  });
  it("none returns same date", () => {
    expect(advanceDeadline("2026-06-20", "none")).toBe("2026-06-20");
  });
});

describe("calendar math", () => {
  it("daysInMonth June 2026 = 30", () => {
    expect(daysInMonth(2026, 5)).toBe(30);
  });
  it("firstDayOfMonth June 2026 = Monday(1)", () => {
    expect(firstDayOfMonth(2026, 5)).toBe(1);
  });
});

describe("daysLeft (uses real today)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00"));
  });
  afterEach(() => vi.useRealTimers());

  it("future deadline is positive", () => {
    expect(daysLeft("2026-06-20")).toBe(5);
  });
  it("today is 0", () => {
    expect(daysLeft("2026-06-15")).toBe(0);
  });
  it("past deadline is negative", () => {
    expect(daysLeft("2026-06-10")).toBe(-5);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/utils.test.ts`
Expected: FAIL（`@/lib/utils` 不存在）。

- [ ] **Step 3: 写实现(本任务部分)**

创建 `src/lib/utils.ts`:
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { RecurrenceType } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export type DateFormat = "short" | "session";
export function formatDate(iso: string, fmt: DateFormat = "short"): string {
  const d = new Date(iso + "T00:00:00");
  if (fmt === "session") {
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function daysLeft(deadline: string): number {
  return Math.ceil((new Date(deadline + "T00:00:00").getTime() - today().getTime()) / 86400000);
}

export function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}

export function firstDayOfMonth(y: number, m: number) {
  return new Date(y, m, 1).getDay();
}

export function advanceDeadline(deadline: string, recurrence: RecurrenceType): string {
  const d = new Date(deadline + "T00:00:00");
  if (recurrence === "daily") d.setDate(d.getDate() + 1);
  else if (recurrence === "weekly") d.setDate(d.getDate() + 7);
  else if (recurrence === "monthly") d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/lib/utils.test.ts`
Expected: PASS（全部用例）。

- [ ] **Step 5: 提交**

```bash
git add src/lib/utils.ts src/lib/utils.test.ts
git commit -m "feat: add date/format utils with tests"
```

---

## Task 5: lib/utils — 任务逻辑(TDD)

**Files:**
- Modify: `src/lib/utils.ts`
- Test: `src/lib/utils.test.ts`(追加)

- [ ] **Step 1: 追加失败测试**

在 `src/lib/utils.test.ts` 末尾追加:
```ts
import {
  completeRecurringTask, createWorkSession, sortTasks,
  isTodayTask, selectListTasks, generateOptimizations,
} from "@/lib/utils";
import type { Task } from "@/types";

function mkTask(over: Partial<Task> = {}): Task {
  return {
    id: over.id ?? uid(),
    title: over.title ?? "T",
    description: "",
    priority: over.priority ?? "medium",
    status: over.status ?? "todo",
    deadline: over.deadline ?? "2026-06-20",
    steps: over.steps ?? [],
    folderId: over.folderId,
    workspaceId: over.workspaceId,
    recurrence: over.recurrence ?? "none",
  };
}

describe("completeRecurringTask", () => {
  it("advances deadline, resets to todo, unchecks steps", () => {
    const t = mkTask({
      status: "done", recurrence: "weekly", deadline: "2026-06-20",
      steps: [{ id: "s1", title: "a", done: true }],
    });
    const next = completeRecurringTask(t);
    expect(next.status).toBe("todo");
    expect(next.deadline).toBe("2026-06-27");
    expect(next.steps[0].done).toBe(false);
  });
});

describe("createWorkSession", () => {
  it("builds a session with given fields and a string id", () => {
    const s = createWorkSession("2026-06-15", 120, "note");
    expect(s.date).toBe("2026-06-15");
    expect(s.duration).toBe(120);
    expect(s.comment).toBe("note");
    expect(typeof s.id).toBe("string");
  });
});

describe("sortTasks", () => {
  it("done last, then by priority, then by deadline", () => {
    const done = mkTask({ id: "d", status: "done", priority: "critical" });
    const low = mkTask({ id: "low", priority: "low", deadline: "2026-06-10" });
    const crit = mkTask({ id: "crit", priority: "critical", deadline: "2026-06-30" });
    const out = sortTasks([done, low, crit]).map(t => t.id);
    expect(out).toEqual(["crit", "low", "d"]);
  });
});

describe("isTodayTask (fake time 2026-06-15)", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-06-15T12:00:00")); });
  afterEach(() => vi.useRealTimers());
  it("in-progress is today", () => {
    expect(isTodayTask(mkTask({ status: "in-progress", deadline: "2026-12-01" }))).toBe(true);
  });
  it("due tomorrow is today", () => {
    expect(isTodayTask(mkTask({ deadline: "2026-06-16" }))).toBe(true);
  });
  it("far future todo is not today", () => {
    expect(isTodayTask(mkTask({ deadline: "2026-12-01" }))).toBe(false);
  });
  it("done is never today", () => {
    expect(isTodayTask(mkTask({ status: "done", deadline: "2026-06-15" }))).toBe(false);
  });
});

describe("selectListTasks", () => {
  it("'all' returns sorted everything", () => {
    const a = mkTask({ id: "a", priority: "low" });
    const b = mkTask({ id: "b", priority: "critical" });
    expect(selectListTasks([a, b], "all").map(t => t.id)).toEqual(["b", "a"]);
  });
  it("folder key filters by folderId", () => {
    const a = mkTask({ id: "a", folderId: "f1" });
    const b = mkTask({ id: "b", folderId: "f2" });
    expect(selectListTasks([a, b], "f1").map(t => t.id)).toEqual(["a"]);
  });
  it("'calendar' returns empty", () => {
    expect(selectListTasks([mkTask()], "calendar")).toEqual([]);
  });
});

describe("generateOptimizations (fake time 2026-06-15)", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-06-15T12:00:00")); });
  afterEach(() => vi.useRealTimers());
  it("flags an imminent non-critical todo and caps at 5", () => {
    const tasks = [mkTask({ status: "todo", priority: "high", deadline: "2026-06-17" })];
    const out = generateOptimizations(tasks);
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThanOrEqual(5);
    expect(out[0].taskId).toBe(tasks[0].id);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/utils.test.ts`
Expected: FAIL（新函数未定义）。

- [ ] **Step 3: 追加实现**

在 `src/lib/utils.ts` 末尾追加(并把 `Task`、`WorkSession`、`OptimizeSuggestion`、`Priority` 加进顶部 type import):
```ts
import type { Task, WorkSession, OptimizeSuggestion, Priority } from "@/types";

export function completeRecurringTask(task: Task): Task {
  return {
    ...task,
    status: "todo",
    deadline: advanceDeadline(task.deadline, task.recurrence),
    steps: task.steps.map(s => ({ ...s, done: false })),
  };
}

export function createWorkSession(date: string, duration: number, comment: string): WorkSession {
  return { id: uid(), date, duration, comment };
}

const PRIORITY_ORDER: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function sortTasks(arr: Task[]): Task[] {
  return [...arr].sort((a, b) => {
    if ((a.status === "done") !== (b.status === "done")) return a.status === "done" ? 1 : -1;
    if (PRIORITY_ORDER[a.priority] !== PRIORITY_ORDER[b.priority]) return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    return a.deadline.localeCompare(b.deadline);
  });
}

export function isTodayTask(t: Task): boolean {
  return t.status !== "done" && (daysLeft(t.deadline) <= 1 || t.status === "in-progress");
}

export function selectListTasks(tasks: Task[], listKey: string): Task[] {
  const filtered =
    listKey === "today" ? tasks.filter(isTodayTask)
    : listKey === "all" ? tasks
    : listKey === "calendar" ? []
    : tasks.filter(t => t.folderId === listKey);
  return sortTasks(filtered);
}

export function generateOptimizations(tasks: Task[]): OptimizeSuggestion[] {
  const suggestions: OptimizeSuggestion[] = [];
  tasks.forEach(t => {
    const dl = daysLeft(t.deadline);
    if (t.status === "todo" && dl <= 7 && dl >= 0 && t.priority !== "critical") {
      suggestions.push({
        id: uid(), tag: "Priority", taskId: t.id, field: "priority", value: "critical",
        title: `Upgrade "${t.title}" to Critical`,
        description: `Due in ${dl} day${dl === 1 ? "" : "s"} with no progress. Marking critical surfaces it at the top of your list.`,
        status: "pending",
      });
    }
    if (t.status === "todo" && dl <= 5 && dl >= 0) {
      suggestions.push({
        id: uid(), tag: "Status", taskId: t.id, field: "status", value: "in-progress",
        title: `Start "${t.title}" now`,
        description: `Due in ${dl} day${dl === 1 ? "" : "s"} and still marked To Do. Set it to In Progress to keep it visible.`,
        status: "pending",
      });
    }
    if (t.priority !== "critical" && t.status === "in-progress" && dl <= 3 && dl >= 0) {
      suggestions.push({
        id: uid(), tag: "Priority", taskId: t.id, field: "priority", value: "critical",
        title: `Prioritize "${t.title}"`,
        description: `In progress and due in ${dl} day${dl === 1 ? "" : "s"}. Bump it to Critical so it leads your list.`,
        status: "pending",
      });
    }
  });
  return suggestions.slice(0, 5);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/lib/utils.test.ts`
Expected: PASS（全部用例)。

- [ ] **Step 5: 提交**

```bash
git add src/lib/utils.ts src/lib/utils.test.ts
git commit -m "feat: add task-logic utils with tests"
```

---

## Task 6: lib/storage(TDD)

**Files:**
- Create: `src/lib/storage.ts`
- Test: `src/lib/storage.test.ts`

- [ ] **Step 1: 写失败测试**

`src/lib/storage.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { loadState, saveState, loadTimer, saveTimer } from "@/lib/storage";
import type { PersistedState, PersistedTimer } from "@/lib/storage";

beforeEach(() => localStorage.clear());

const sample: PersistedState = {
  tasks: [], folders: [{ id: "f1", name: "X" }], workspaces: [], gcalConnected: true,
};

describe("state persistence", () => {
  it("returns null when nothing stored", () => {
    expect(loadState()).toBeNull();
  });
  it("round-trips saved state", () => {
    saveState(sample);
    expect(loadState()).toEqual(sample);
  });
  it("returns null on corrupt JSON", () => {
    localStorage.setItem("agenda:v1", "{not json");
    expect(loadState()).toBeNull();
  });
  it("returns null when shape is wrong", () => {
    localStorage.setItem("agenda:v1", JSON.stringify({ nope: true }));
    expect(loadState()).toBeNull();
  });
});

describe("timer persistence", () => {
  const timer: PersistedTimer = { workspaceId: "w1", running: true, accumulated: 30, startedAt: 1000 };
  it("returns null when nothing stored", () => {
    expect(loadTimer()).toBeNull();
  });
  it("round-trips timer", () => {
    saveTimer(timer);
    expect(loadTimer()).toEqual(timer);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 写实现**

`src/lib/storage.ts`:
```ts
import type { Task, Folder, Workspace } from "@/types";

export interface PersistedState {
  tasks: Task[];
  folders: Folder[];
  workspaces: Workspace[];
  gcalConnected: boolean;
}

export interface PersistedTimer {
  workspaceId: string | null;
  running: boolean;
  accumulated: number;
  startedAt: number | null;
}

const STATE_KEY = "agenda:v1";
const TIMER_KEY = "agenda:timer:v1";

export function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.folders) || !Array.isArray(parsed.workspaces)) {
      return null;
    }
    return parsed as PersistedState;
  } catch {
    return null;
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / unavailable */
  }
}

export function loadTimer(): PersistedTimer | null {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.running !== "boolean") return null;
    return parsed as PersistedTimer;
  } catch {
    return null;
  }
}

export function saveTimer(timer: PersistedTimer): void {
  try {
    localStorage.setItem(TIMER_KEY, JSON.stringify(timer));
  } catch {
    /* ignore */
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/lib/storage.ts src/lib/storage.test.ts
git commit -m "feat: add versioned localStorage persistence with tests"
```

---

## Task 7: store/taskReducer(TDD)

**Files:**
- Create: `src/store/taskReducer.ts`
- Test: `src/store/taskReducer.test.ts`

- [ ] **Step 1: 写失败测试**

`src/store/taskReducer.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { taskReducer, type DataState } from "@/store/taskReducer";
import type { Task, Folder, Workspace } from "@/types";

function base(): DataState {
  const task: Task = {
    id: "t1", title: "A", description: "", priority: "medium", status: "todo",
    deadline: "2026-06-20", steps: [{ id: "s1", title: "x", done: false }],
    folderId: "f1", workspaceId: "w1", recurrence: "weekly",
  };
  const folder: Folder = { id: "f1", name: "F" };
  const ws: Workspace = { id: "w1", name: "A", taskId: "t1", resources: [], sessions: [] };
  return { tasks: [task], folders: [folder], workspaces: [ws], gcalConnected: false };
}

describe("taskReducer", () => {
  it("ADD_TASK appends", () => {
    const t: Task = { id: "t2", title: "B", description: "", priority: "low", status: "todo", deadline: "2026-06-21", steps: [], recurrence: "none" };
    const s = taskReducer(base(), { type: "ADD_TASK", task: t });
    expect(s.tasks.map(x => x.id)).toEqual(["t1", "t2"]);
  });

  it("UPDATE_TASK merges fields", () => {
    const s = taskReducer(base(), { type: "UPDATE_TASK", id: "t1", updates: { priority: "critical" } });
    expect(s.tasks[0].priority).toBe("critical");
  });

  it("TOGGLE_TASK todo→done checks all steps", () => {
    const s = taskReducer(base(), { type: "TOGGLE_TASK", id: "t1" });
    expect(s.tasks[0].status).toBe("done");
    expect(s.tasks[0].steps.every(st => st.done)).toBe(true);
  });

  it("TOGGLE_TASK done→todo flips back", () => {
    const done = taskReducer(base(), { type: "TOGGLE_TASK", id: "t1" });
    const back = taskReducer(done, { type: "TOGGLE_TASK", id: "t1" });
    expect(back.tasks[0].status).toBe("todo");
  });

  it("RESET_RECURRING advances and resets", () => {
    const s = taskReducer(base(), { type: "RESET_RECURRING", id: "t1" });
    expect(s.tasks[0].status).toBe("todo");
    expect(s.tasks[0].deadline).toBe("2026-06-27");
    expect(s.tasks[0].steps[0].done).toBe(false);
  });

  it("DELETE_TASK removes task and its workspace", () => {
    const s = taskReducer(base(), { type: "DELETE_TASK", id: "t1" });
    expect(s.tasks).toHaveLength(0);
    expect(s.workspaces).toHaveLength(0);
  });

  it("DELETE_FOLDER removes folder and clears folderId", () => {
    const s = taskReducer(base(), { type: "DELETE_FOLDER", id: "f1" });
    expect(s.folders).toHaveLength(0);
    expect(s.tasks[0].folderId).toBeUndefined();
  });

  it("ADD_SESSION appends to workspace", () => {
    const s = taskReducer(base(), { type: "ADD_SESSION", workspaceId: "w1", session: { id: "x", date: "2026-06-15", duration: 10, comment: "c" } });
    expect(s.workspaces[0].sessions).toHaveLength(1);
  });

  it("APPLY_OPTIMIZATION sets arbitrary field", () => {
    const s = taskReducer(base(), { type: "APPLY_OPTIMIZATION", taskId: "t1", field: "status", value: "in-progress" });
    expect(s.tasks[0].status).toBe("in-progress");
  });

  it("SET_GCAL toggles flag", () => {
    const s = taskReducer(base(), { type: "SET_GCAL", connected: true });
    expect(s.gcalConnected).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/store/taskReducer.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 写实现**

`src/store/taskReducer.ts`:
```ts
import type { Task, Folder, Workspace, WorkSession } from "@/types";
import { completeRecurringTask } from "@/lib/utils";
import { loadState, type PersistedState } from "@/lib/storage";
import { INIT_TASKS, INIT_FOLDERS, INIT_WORKSPACES } from "@/constants";

export interface DataState {
  tasks: Task[];
  folders: Folder[];
  workspaces: Workspace[];
  gcalConnected: boolean;
}

export type DataAction =
  | { type: "ADD_TASK"; task: Task }
  | { type: "UPDATE_TASK"; id: string; updates: Partial<Task> }
  | { type: "TOGGLE_TASK"; id: string }
  | { type: "RESET_RECURRING"; id: string }
  | { type: "DELETE_TASK"; id: string }
  | { type: "ADD_FOLDER"; folder: Folder }
  | { type: "RENAME_FOLDER"; id: string; name: string }
  | { type: "DELETE_FOLDER"; id: string }
  | { type: "ENSURE_WORKSPACE"; taskId: string; workspace: Workspace }
  | { type: "UPDATE_WORKSPACE"; id: string; updates: Partial<Workspace> }
  | { type: "ADD_SESSION"; workspaceId: string; session: WorkSession }
  | { type: "APPLY_OPTIMIZATION"; taskId: string; field: string; value: unknown }
  | { type: "SET_GCAL"; connected: boolean };

export function taskReducer(state: DataState, action: DataAction): DataState {
  switch (action.type) {
    case "ADD_TASK":
      return { ...state, tasks: [...state.tasks, action.task] };

    case "UPDATE_TASK":
      return { ...state, tasks: state.tasks.map(t => t.id === action.id ? { ...t, ...action.updates } : t) };

    case "TOGGLE_TASK": {
      const task = state.tasks.find(t => t.id === action.id);
      if (!task) return state;
      if (task.status === "done") {
        return { ...state, tasks: state.tasks.map(t => t.id === action.id ? { ...t, status: "todo" } : t) };
      }
      return {
        ...state,
        tasks: state.tasks.map(t => t.id === action.id ? { ...t, status: "done", steps: t.steps.map(s => ({ ...s, done: true })) } : t),
      };
    }

    case "RESET_RECURRING":
      return { ...state, tasks: state.tasks.map(t => t.id === action.id ? completeRecurringTask(t) : t) };

    case "DELETE_TASK": {
      const task = state.tasks.find(t => t.id === action.id);
      return {
        ...state,
        tasks: state.tasks.filter(t => t.id !== action.id),
        workspaces: task?.workspaceId ? state.workspaces.filter(w => w.id !== task.workspaceId) : state.workspaces,
      };
    }

    case "ADD_FOLDER":
      return { ...state, folders: [...state.folders, action.folder] };

    case "RENAME_FOLDER":
      return { ...state, folders: state.folders.map(f => f.id === action.id ? { ...f, name: action.name } : f) };

    case "DELETE_FOLDER":
      return {
        ...state,
        folders: state.folders.filter(f => f.id !== action.id),
        tasks: state.tasks.map(t => t.folderId === action.id ? { ...t, folderId: undefined } : t),
      };

    case "ENSURE_WORKSPACE":
      return {
        ...state,
        workspaces: [...state.workspaces, action.workspace],
        tasks: state.tasks.map(t => t.id === action.taskId ? { ...t, workspaceId: action.workspace.id } : t),
      };

    case "UPDATE_WORKSPACE":
      return { ...state, workspaces: state.workspaces.map(w => w.id === action.id ? { ...w, ...action.updates } : w) };

    case "ADD_SESSION":
      return {
        ...state,
        workspaces: state.workspaces.map(w => w.id === action.workspaceId ? { ...w, sessions: [...w.sessions, action.session] } : w),
      };

    case "APPLY_OPTIMIZATION":
      return { ...state, tasks: state.tasks.map(t => t.id === action.taskId ? { ...t, [action.field]: action.value } : t) };

    case "SET_GCAL":
      return { ...state, gcalConnected: action.connected };

    default:
      return state;
  }
}

export function initDataState(): DataState {
  const persisted: PersistedState | null = loadState();
  if (persisted) return persisted;
  return { tasks: INIT_TASKS, folders: INIT_FOLDERS, workspaces: INIT_WORKSPACES, gcalConnected: false };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/store/taskReducer.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/store/taskReducer.ts src/store/taskReducer.test.ts
git commit -m "feat: add pure taskReducer with tests"
```

---

## Task 8: store/TaskProvider

**Files:**
- Create: `src/store/TaskProvider.tsx`

- [ ] **Step 1: 写实现**

`src/store/TaskProvider.tsx`:
```tsx
import { createContext, useContext, useEffect, useReducer, type ReactNode, type Dispatch } from "react";
import { taskReducer, initDataState, type DataState, type DataAction } from "@/store/taskReducer";
import { saveState } from "@/lib/storage";

interface TaskStore {
  state: DataState;
  dispatch: Dispatch<DataAction>;
}

const TaskContext = createContext<TaskStore | null>(null);

export function TaskProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(taskReducer, undefined, initDataState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  return <TaskContext.Provider value={{ state, dispatch }}>{children}</TaskContext.Provider>;
}

export function useTaskStore(): TaskStore {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error("useTaskStore must be used within TaskProvider");
  return ctx;
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无新错误。

- [ ] **Step 3: 提交**

```bash
git add src/store/TaskProvider.tsx
git commit -m "feat: add TaskProvider with localStorage write-through"
```

---

## Task 9: store/TimerProvider

**Files:**
- Create: `src/store/TimerProvider.tsx`

- [ ] **Step 1: 写实现**

`src/store/TimerProvider.tsx`(嵌套在 TaskProvider 内,end/切换时向数据 store 派发 `ADD_SESSION`):
```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useTaskStore } from "@/store/TaskProvider";
import { createWorkSession, todayISO } from "@/lib/utils";
import { loadTimer, saveTimer, type PersistedTimer } from "@/lib/storage";

interface TimerState {
  workspaceId: string | null;
  running: boolean;
  accumulated: number;
  startedAt: number | null;
}

function computeElapsed(s: TimerState): number {
  return s.accumulated + (s.running && s.startedAt ? Math.floor((Date.now() - s.startedAt) / 1000) : 0);
}

interface TimerApi {
  workspaceId: string | null;
  running: boolean;
  elapsed: number;
  start: (workspaceId: string) => void;
  pause: () => void;
  end: (workspaceId: string, comment: string) => void;
  reset: () => void;
}

const EMPTY: TimerState = { workspaceId: null, running: false, accumulated: 0, startedAt: null };
const TimerContext = createContext<TimerApi | null>(null);

export function TimerProvider({ children }: { children: ReactNode }) {
  const { dispatch } = useTaskStore();
  const [state, setState] = useState<TimerState>(() => (loadTimer() as TimerState | null) ?? EMPTY);
  const [, setTick] = useState(0);

  useEffect(() => {
    saveTimer(state as PersistedTimer);
  }, [state]);

  useEffect(() => {
    if (!state.running) return;
    const i = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(i);
  }, [state.running]);

  const elapsed = computeElapsed(state);

  function start(workspaceId: string) {
    if (state.workspaceId !== workspaceId) {
      const prevElapsed = computeElapsed(state);
      if (prevElapsed > 0 && state.workspaceId) {
        dispatch({ type: "ADD_SESSION", workspaceId: state.workspaceId, session: createWorkSession(todayISO(), prevElapsed, "Auto-saved on switch") });
      }
      setState({ workspaceId, running: true, accumulated: 0, startedAt: Date.now() });
    } else {
      setState(prev => ({ ...prev, running: true, startedAt: Date.now() }));
    }
  }

  function pause() {
    setState(prev => prev.running ? { ...prev, running: false, accumulated: computeElapsed(prev), startedAt: null } : prev);
  }

  function end(workspaceId: string, comment: string) {
    const e = computeElapsed(state);
    if (e > 0) {
      dispatch({ type: "ADD_SESSION", workspaceId, session: createWorkSession(todayISO(), e, comment) });
    }
    setState(EMPTY);
  }

  function reset() {
    setState(EMPTY);
  }

  return (
    <TimerContext.Provider value={{ workspaceId: state.workspaceId, running: state.running, elapsed, start, pause, end, reset }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer(): TimerApi {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be used within TimerProvider");
  return ctx;
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无新错误。

- [ ] **Step 3: 提交**

```bash
git add src/store/TimerProvider.tsx
git commit -m "feat: add TimerProvider with persisted resumable timer"
```

---

## Task 10: hooks(useTasks / useFolders / useWorkspaces)

**Files:**
- Create: `src/hooks/useTasks.ts`、`src/hooks/useFolders.ts`、`src/hooks/useWorkspaces.ts`

- [ ] **Step 1: 写 `src/hooks/useWorkspaces.ts`**

```ts
import { useTaskStore } from "@/store/TaskProvider";
import type { Workspace } from "@/types";

export function useWorkspaces() {
  const { state, dispatch } = useTaskStore();
  return {
    workspaces: state.workspaces,
    getWorkspace: (id?: string) => id ? state.workspaces.find(w => w.id === id) : undefined,
    updateWorkspace: (id: string, updates: Partial<Workspace>) => dispatch({ type: "UPDATE_WORKSPACE", id, updates }),
  };
}
```

- [ ] **Step 2: 写 `src/hooks/useFolders.ts`**

```ts
import { useTaskStore } from "@/store/TaskProvider";
import { uid } from "@/lib/utils";

export function useFolders() {
  const { state, dispatch } = useTaskStore();
  return {
    folders: state.folders,
    createFolder: (name: string): string => {
      const id = uid();
      dispatch({ type: "ADD_FOLDER", folder: { id, name } });
      return id;
    },
    renameFolder: (id: string, name: string) => dispatch({ type: "RENAME_FOLDER", id, name }),
    deleteFolder: (id: string) => dispatch({ type: "DELETE_FOLDER", id }),
  };
}
```

- [ ] **Step 3: 写 `src/hooks/useTasks.ts`**

```ts
import { toast } from "sonner";
import { useTaskStore } from "@/store/TaskProvider";
import { useTimer } from "@/store/TimerProvider";
import { uid, todayISO, advanceDeadline, formatDate } from "@/lib/utils";
import type { Task } from "@/types";

export function useTasks() {
  const { state, dispatch } = useTaskStore();
  const timer = useTimer();

  function findTask(id: string) {
    return state.tasks.find(t => t.id === id);
  }

  function handleCompletionSideEffects(task: Task) {
    if (timer.running && task.workspaceId && timer.workspaceId === task.workspaceId) {
      timer.end(task.workspaceId, "Task marked as done.");
    }
    if (task.recurrence !== "none") {
      setTimeout(() => {
        dispatch({ type: "RESET_RECURRING", id: task.id });
        toast.success(`Recurring task reset — next: ${formatDate(advanceDeadline(task.deadline, task.recurrence), "short")}`);
      }, 600);
    }
  }

  function ensureWorkspace(task: Task): string {
    if (task.workspaceId) return task.workspaceId;
    const id = uid();
    dispatch({ type: "ENSURE_WORKSPACE", taskId: task.id, workspace: { id, name: task.title, taskId: task.id, resources: [], sessions: [] } });
    return id;
  }

  return {
    tasks: state.tasks,
    getTask: findTask,

    addTask: (title: string, opts?: { deadline?: string; folderId?: string }) => {
      const t = title.trim();
      if (!t) return;
      dispatch({
        type: "ADD_TASK",
        task: {
          id: uid(), title: t, description: "", priority: "medium", status: "todo",
          deadline: opts?.deadline ?? todayISO(), steps: [], folderId: opts?.folderId, recurrence: "none",
        },
      });
    },

    updateTask: (id: string, updates: Partial<Task>) => {
      dispatch({ type: "UPDATE_TASK", id, updates });
      if (updates.status === "done") {
        const task = findTask(id);
        if (task) handleCompletionSideEffects(task);
      }
    },

    toggleDone: (id: string) => {
      const task = findTask(id);
      if (!task) return;
      const wasDone = task.status === "done";
      dispatch({ type: "TOGGLE_TASK", id });
      if (!wasDone) {
        handleCompletionSideEffects(task);
        if (task.recurrence === "none") toast.success("Task completed");
      }
    },

    deleteTask: (id: string) => {
      const task = findTask(id);
      if (!task) return;
      if (task.workspaceId && timer.workspaceId === task.workspaceId) timer.reset();
      dispatch({ type: "DELETE_TASK", id });
    },

    applyOptimization: (taskId: string, field: string, value: unknown) =>
      dispatch({ type: "APPLY_OPTIMIZATION", taskId, field, value }),

    startFocus: (task: Task) => timer.start(ensureWorkspace(task)),
  };
}
```

- [ ] **Step 4: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无新错误。

- [ ] **Step 5: 提交**

```bash
git add src/hooks
git commit -m "feat: add useTasks/useFolders/useWorkspaces action hooks"
```

---

## Task 11: ErrorBoundary

**Files:**
- Create: `src/components/ErrorBoundary.tsx`

- [ ] **Step 1: 写实现**

`src/components/ErrorBoundary.tsx`:
```tsx
import { Component, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { hasError: boolean; error?: Error }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("Agenda crashed:", error);
  }

  reset = () => this.setState({ hasError: false, error: undefined });

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <div className="flex gap-2">
            <button onClick={this.reset} className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90">
              Try again
            </button>
            <button onClick={() => window.location.reload()} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary">
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无新错误。

- [ ] **Step 3: 提交**

```bash
git add src/components/ErrorBoundary.tsx
git commit -m "feat: add top-level ErrorBoundary"
```

---

## Tasks 12–14:迁移展示组件(纯移动 + 改 import)

> 这三批组件**几乎纯展示**,迁移=把组件体从 `App.tsx` 原样复制到新文件,改为 `export default`,把所有类型/常量/工具函数改为从 `@/types`、`@/constants`、`@/lib/utils` import(把 `fmtTime`→`formatDuration`、`fmtDate`→`formatDate(x,"short")`、`fmtSessionDate`→`formatDate(x,"session")`),其余 props 接口与 JSX **保持不变**。每个 feature 目录加一个 `index.ts` barrel:`export { default } from "./<Comp>";`。此阶段它们尚未被新路由使用,旧 `App.tsx` 仍在跑——仅做编译验证。

### Task 12: EndSessionModal + AIOptimizeModal + AIPlanPanel

**Files:**
- Create: `src/features/end-session/EndSessionModal.tsx`(+ `index.ts`)
- Create: `src/features/ai-optimize/AIOptimizeModal.tsx`(+ `index.ts`)
- Create: `src/features/ai-plan/AIPlanPanel.tsx`(+ `index.ts`)

- [ ] **Step 1: 迁移 EndSessionModal**

复制 `App.tsx` 第 339–380 行的 `EndSessionModal`。改动:
- `function EndSessionModal(` → `export default function EndSessionModal(`
- 顶部加:`import { useState } from "react";`、`import { motion } from "motion/react";`、`import { formatDuration } from "@/lib/utils";`
- 函数体内 `fmtTime(elapsed)` → `formatDuration(elapsed)`
其余不变。`index.ts`:`export { default } from "./EndSessionModal";`

- [ ] **Step 2: 迁移 AIOptimizeModal**

复制 `App.tsx` 第 912–1030 行的 `AIOptimizeModal`。改动:
- 改 `export default function`
- import:`import { useState, useEffect } from "react";`、`import { motion } from "motion/react";`、`import { toast } from "sonner";`、`import { Wand2, X, Check } from "lucide-react";`、`import { generateOptimizations } from "@/lib/utils";`、`import type { Task, OptimizeSuggestion } from "@/types";`
其余不变。`index.ts` barrel。

- [ ] **Step 3: 迁移 AIPlanPanel**

复制 `App.tsx` 第 1236–1435 行的 `AIPlanPanel`。改动:
- 改 `export default function`
- import:`import { useState } from "react";`、`import { motion } from "motion/react";`、`import { Brain, X, ListTodo, CalendarDays, Sparkles, RefreshCcw, Check } from "lucide-react";`、`import { PLAN_TEMPLATE } from "@/constants";`、`import type { Task, PlanStep } from "@/types";`
其余不变。`index.ts` barrel。

- [ ] **Step 4: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无新错误。

- [ ] **Step 5: 提交**

```bash
git add src/features/end-session src/features/ai-optimize src/features/ai-plan
git commit -m "refactor: extract EndSession/AIOptimize/AIPlan features"
```

### Task 13: Sidebar + TaskListView + CalendarView

**Files:**
- Create: `src/features/sidebar/Sidebar.tsx`(+ `index.ts`)
- Create: `src/features/task-list/TaskListView.tsx`(+ `index.ts`)
- Create: `src/features/calendar/CalendarView.tsx`(+ `index.ts`)

- [ ] **Step 1: 迁移 Sidebar**

复制 `App.tsx` 第 384–546 行的 `Sidebar`。改动:
- 改 `export default function`
- import:`import { useState } from "react";`、`import { CalendarDays, Plus, Trash2, Zap, Folder, Sun, Layers } from "lucide-react";`、`import { daysLeft } from "@/lib/utils";`、`import type { Folder as FolderType, Task, SmartList } from "@/types";`
- 把 props 接口里的 `folders: Folder[]` 改为 `folders: FolderType[]`(避免与 lucide 的 `Folder` 图标重名);函数体内类型注解 `(f: Folder)` 同改 `FolderType`。
- `daysLeft` 现来自 utils(已用真实今天)。
props 签名与 JSX 其余不变。`index.ts` barrel。

- [ ] **Step 2: 迁移 TaskListView**

复制 `App.tsx` 第 550–668 行的 `TaskListView`。改动:
- 改 `export default function`
- import:`import { useState } from "react";`、`import { Brain, Plus, ChevronRight, Check, Repeat, Folder, Wand2 } from "lucide-react";`、`import { PRIORITY_CFG, RECURRENCE_LABELS } from "@/constants";`、`import { daysLeft, formatDate } from "@/lib/utils";`、`import type { Task, Folder as FolderType } from "@/types";`
- 函数体内 `fmtDate(task.deadline)` → `formatDate(task.deadline, "short")`;`folders: Folder[]` → `FolderType[]`。
其余不变。`index.ts` barrel。

- [ ] **Step 3: 迁移 CalendarView**

复制 `App.tsx` 第 1035–1231 行的 `CalendarView`。改动:
- 改 `export default function`
- import:`import { useState } from "react";`、`import { ChevronLeft, ChevronRight, CalendarDays, RefreshCcw, AlertTriangle, Plus } from "lucide-react";`、`import { PRIORITY_CFG } from "@/constants";`、`import { daysInMonth, firstDayOfMonth } from "@/lib/utils";`、`import type { Task, GCalEvent, Priority } from "@/types";`
- **行为变更(决策 #3):** 把第 1043 行 `useState(new Date("2026-06-01"))` 改为 `useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })`;第 1044 行 `useState<number | null>(5)` 改为 `useState<number | null>(new Date().getDate())`;第 1120 行 `const isToday = year === 2026 && month === 5 && day === 5;` 改为 `const now = new Date(); const isToday = year === now.getFullYear() && month === now.getMonth() && day === now.getDate();`
其余不变。`index.ts` barrel。

- [ ] **Step 4: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无新错误。

- [ ] **Step 5: 提交**

```bash
git add src/features/sidebar src/features/task-list src/features/calendar
git commit -m "refactor: extract Sidebar/TaskListView/CalendarView features"
```

### Task 14: TaskDetailPanel + OnboardingOverlay

**Files:**
- Create: `src/features/task-detail/TaskDetailPanel.tsx`(+ `index.ts`)
- Create: `src/features/onboarding/OnboardingOverlay.tsx`(+ `index.ts`)

- [ ] **Step 1: 迁移 TaskDetailPanel**

复制 `App.tsx` 第 672–908 行的 `TaskDetailPanel`,**props 接口与函数体保持原样**(它仍接收 props;Task 15 的 `TaskRoute` 负责从 hooks 取值后传入)。改动:
- 改 `export default function`
- import:`import { useState } from "react";`、`import { ArrowLeft, ChevronLeft, ChevronRight, Play, Pause, Square, Plus, Check, Trash2, X, Link2, FileText, StickyNote } from "lucide-react";`、`import { formatDuration, formatDate, uid } from "@/lib/utils";`、`import type { Task, Workspace, Folder as FolderType, Resource, ResourceType } from "@/types";`
- 函数体内 `fmtTime(...)` → `formatDuration(...)`;`fmtSessionDate(s.date)` → `formatDate(s.date, "session")`;`folders: Folder[]` → `FolderType[]`。
其余不变。`index.ts` barrel。

- [ ] **Step 2: 迁移 OnboardingOverlay(含 JSX 常量)**

复制 `App.tsx` 第 1442–1458 行的 `ONBOARDING_SLIDES` 与第 1460–1526 行的 `OnboardingOverlay` 一起进此文件(`ONBOARDING_SLIDES` 含 JSX,故留在该 `.tsx`)。改动:
- 改 `export default function OnboardingOverlay`
- import:`import { useState } from "react";`、`import { motion, AnimatePresence } from "motion/react";`、`import { Sun, Layers, Play, Zap, ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";`
其余不变。`index.ts` barrel。

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无新错误。

- [ ] **Step 4: 提交**

```bash
git add src/features/task-detail src/features/onboarding
git commit -m "refactor: extract TaskDetailPanel/OnboardingOverlay features"
```

---

## Task 15: 路由层(Layout / ListRoute / CalendarRoute / TaskRoute)

**Files:**
- Create: `src/routes/Layout.tsx`、`src/routes/ListRoute.tsx`、`src/routes/CalendarRoute.tsx`、`src/routes/TaskRoute.tsx`

- [ ] **Step 1: 写 `src/routes/Layout.tsx`**

侧边栏持久 + `<Outlet>` + Toaster + onboarding;AI 面板由 `?panel=optimize|plan` 搜索参数驱动。
```tsx
import { useState } from "react";
import { Outlet, useNavigate, useSearchParams, useLocation } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Toaster } from "sonner";
import Sidebar from "@/features/sidebar";
import AIOptimizeModal from "@/features/ai-optimize";
import AIPlanPanel from "@/features/ai-plan";
import OnboardingOverlay from "@/features/onboarding";
import { useTasks } from "@/hooks/useTasks";
import { useFolders } from "@/hooks/useFolders";
import { useTimer } from "@/store/TimerProvider";
import { formatDuration } from "@/lib/utils";

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { tasks, applyOptimization } = useTasks();
  const { folders, createFolder, renameFolder, deleteFolder } = useFolders();
  const timer = useTimer();
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem("ff_onboarded"));

  const panel = searchParams.get("panel");
  function closePanel() {
    const next = new URLSearchParams(searchParams);
    next.delete("panel");
    setSearchParams(next, { replace: true });
  }

  // active list key derived from URL
  const path = location.pathname;
  const activeList =
    path.startsWith("/all") ? "all"
    : path.startsWith("/calendar") ? "calendar"
    : path.startsWith("/folder/") ? path.split("/folder/")[1]
    : "today";

  const timerTask = timer.workspaceId ? tasks.find(t => t.workspaceId === timer.workspaceId) : null;

  function dismissOnboarding() {
    try { localStorage.setItem("ff_onboarded", "1"); } catch { /* ignore */ }
    setShowOnboarding(false);
    navigate("/today");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
      <Toaster position="bottom-right" />
      <Sidebar
        activeList={activeList}
        onSelectList={(id) => navigate(id === "today" || id === "all" || id === "calendar" ? `/${id}` : `/folder/${id}`)}
        folders={folders}
        tasks={tasks}
        onCreateFolder={(name) => { const id = createFolder(name); navigate(`/folder/${id}`); }}
        onRenameFolder={renameFolder}
        onDeleteFolder={(id) => { deleteFolder(id); if (activeList === id) navigate("/all"); }}
        timerRunning={timer.running}
        timerDisplay={formatDuration(timer.elapsed)}
        timerTaskName={timerTask?.title ?? ""}
      />

      <main className="relative flex flex-1 overflow-hidden">
        <Outlet />

        <AnimatePresence>
          {panel === "plan" && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                className="absolute inset-0 z-30 bg-black/25" onClick={closePanel} />
              <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="absolute right-0 top-0 z-40 h-full w-[480px] border-l border-border bg-card shadow-2xl">
                <AIPlanPanel tasks={tasks} onClose={closePanel} />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>

      {panel === "optimize" && (
        <AIOptimizeModal tasks={tasks} onApply={applyOptimization} onClose={closePanel} />
      )}
      {showOnboarding && <OnboardingOverlay onDone={dismissOnboarding} />}
    </div>
  );
}
```

- [ ] **Step 2: 写 `src/routes/ListRoute.tsx`**

```tsx
import { useNavigate, useParams, useSearchParams } from "react-router";
import TaskListView from "@/features/task-list";
import { useTasks } from "@/hooks/useTasks";
import { useFolders } from "@/hooks/useFolders";
import { selectListTasks } from "@/lib/utils";

export default function ListRoute({ scope }: { scope: "today" | "all" | "folder" }) {
  const navigate = useNavigate();
  const { folderId } = useParams();
  const [, setSearchParams] = useSearchParams();
  const { tasks, addTask, toggleDone } = useTasks();
  const { folders } = useFolders();

  const listKey = scope === "folder" ? (folderId ?? "") : scope;
  const listTasks = selectListTasks(tasks, listKey);
  const folder = scope === "folder" ? folders.find(f => f.id === folderId) : undefined;

  const title = scope === "today" ? "Today" : scope === "all" ? "All tasks" : (folder?.name ?? "Tasks");
  const subtitle = scope === "today" ? "Due today, overdue, or in progress"
    : scope === "all" ? "Every task across your lists"
    : folder ? "Tasks in this list" : "";

  return (
    <TaskListView
      title={title}
      subtitle={subtitle}
      tasks={listTasks}
      folders={folders}
      showFolderTag={scope === "all"}
      selectedTaskId={null}
      onSelectTask={(id) => navigate(`/task/${id}?list=${listKey}`)}
      onToggleDone={toggleDone}
      onAddTask={(t) => addTask(t, { folderId: scope === "folder" ? folderId : undefined })}
      onShowOptimize={() => setSearchParams({ panel: "optimize" })}
      onShowAIPlan={() => setSearchParams({ panel: "plan" })}
    />
  );
}
```

- [ ] **Step 3: 写 `src/routes/CalendarRoute.tsx`**

```tsx
import { useNavigate } from "react-router";
import CalendarView from "@/features/calendar";
import { useTasks } from "@/hooks/useTasks";
import { useTaskStore } from "@/store/TaskProvider";
import { GCAL_EVENTS } from "@/constants";

export default function CalendarRoute() {
  const navigate = useNavigate();
  const { tasks, addTask } = useTasks();
  const { state, dispatch } = useTaskStore();

  return (
    <CalendarView
      tasks={tasks}
      gcalEvents={GCAL_EVENTS}
      gcalConnected={state.gcalConnected}
      setGcalConnected={(v) => dispatch({ type: "SET_GCAL", connected: v })}
      onSelectTask={(id) => navigate(`/task/${id}?list=calendar`)}
      onAddTaskForDate={(date) => addTask("New task", { deadline: date })}
    />
  );
}
```

- [ ] **Step 4: 写 `src/routes/TaskRoute.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import TaskDetailPanel from "@/features/task-detail";
import EndSessionModal from "@/features/end-session";
import { useTasks } from "@/hooks/useTasks";
import { useFolders } from "@/hooks/useFolders";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useTimer } from "@/store/TimerProvider";
import { selectListTasks } from "@/lib/utils";

export default function TaskRoute() {
  const navigate = useNavigate();
  const { taskId } = useParams();
  const [searchParams] = useSearchParams();
  const listKey = searchParams.get("list") ?? "all";

  const { tasks, updateTask, toggleDone, deleteTask, startFocus } = useTasks();
  const { folders } = useFolders();
  const { getWorkspace, updateWorkspace } = useWorkspaces();
  const timer = useTimer();
  const [endingWorkspaceId, setEndingWorkspaceId] = useState<string | null>(null);

  const task = tasks.find(t => t.id === taskId);

  useEffect(() => {
    if (!task) toast.error("Task not found");
  }, [task]);

  if (!task) return <Navigate to="/today" replace />;

  const workspace = getWorkspace(task.workspaceId);
  const listIds = selectListTasks(tasks, listKey).map(t => t.id);
  const idx = listIds.indexOf(task.id);
  const backTo = listKey === "calendar" ? "/calendar"
    : listKey === "all" || listKey === "today" ? `/${listKey}`
    : `/folder/${listKey}`;

  function go(toId: string) {
    navigate(`/task/${toId}?list=${listKey}`);
  }

  return (
    <>
      <TaskDetailPanel
        task={task}
        workspace={workspace}
        folders={folders}
        onBack={() => navigate(backTo)}
        onPrev={idx > 0 ? () => go(listIds[idx - 1]) : undefined}
        onNext={idx >= 0 && idx < listIds.length - 1 ? () => go(listIds[idx + 1]) : undefined}
        position={idx >= 0 ? `${idx + 1} / ${listIds.length}` : ""}
        onUpdateTask={(updates) => updateTask(task.id, updates)}
        onToggleDone={() => toggleDone(task.id)}
        onDeleteTask={() => { deleteTask(task.id); navigate(backTo); }}
        timerElapsed={timer.elapsed}
        timerRunning={timer.running}
        timerWorkspaceId={timer.workspaceId}
        onStartFocus={() => startFocus(task)}
        onPause={timer.pause}
        onRequestEnd={(wsId) => setEndingWorkspaceId(wsId)}
        onUpdateWorkspace={updateWorkspace}
      />
      {endingWorkspaceId && (
        <EndSessionModal
          elapsed={timer.elapsed}
          onSave={(comment) => { timer.end(endingWorkspaceId, comment); setEndingWorkspaceId(null); }}
          onCancel={() => setEndingWorkspaceId(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 5: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无新错误(此刻路由文件已可独立编译;旧 `App.tsx` 仍存在)。

- [ ] **Step 6: 提交**

```bash
git add src/routes
git commit -m "feat: add router layer (Layout/List/Calendar/Task routes)"
```

---

## Task 16: 装配 App.tsx + 删除单体

**Files:**
- Modify: `src/app/App.tsx`(整体替换)

- [ ] **Step 1: 用装配层整体替换 `src/app/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import ErrorBoundary from "@/components/ErrorBoundary";
import { TaskProvider } from "@/store/TaskProvider";
import { TimerProvider } from "@/store/TimerProvider";
import Layout from "@/routes/Layout";
import ListRoute from "@/routes/ListRoute";
import CalendarRoute from "@/routes/CalendarRoute";
import TaskRoute from "@/routes/TaskRoute";

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <TaskProvider>
          <TimerProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Navigate to="/today" replace />} />
                <Route path="today" element={<ListRoute scope="today" />} />
                <Route path="all" element={<ListRoute scope="all" />} />
                <Route path="folder/:folderId" element={<ListRoute scope="folder" />} />
                <Route path="calendar" element={<CalendarRoute />} />
                <Route path="task/:taskId" element={<TaskRoute />} />
                <Route path="*" element={<Navigate to="/today" replace />} />
              </Route>
            </Routes>
          </TimerProvider>
        </TaskProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
```

- [ ] **Step 2: 确认 `src/main.tsx` 未变**

`main.tsx` 仍 `import App from "./app/App.tsx"`,无需改动。

- [ ] **Step 3: 类型检查 + 构建**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc 无错误;`vite build` 成功产出 `dist/`。

- [ ] **Step 4: 跑全部测试**

Run: `npm test`
Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add src/app/App.tsx
git commit -m "refactor: reduce App.tsx to assembly layer (router + providers)"
```

---

## Task 17: 手动验证 + 行为契约核对

**Files:** 无(纯验证)

- [ ] **Step 1: 启动 dev**

Run: `npm run dev`
打开输出的本地 URL。

- [ ] **Step 2: 逐条核对 spec 第 10 节行为契约**

1. 初次加载弹 Onboarding(若之前点过 Skip,可在 DevTools 清 `ff_onboarded` 后刷新)。Skip/Get started 后落到 `/today`,URL 为 `/today`。
2. 侧边栏 Today/All 计数、文件夹计数显示;点击切换 URL 相应变化(`/all`、`/folder/<id>`)。
3. 新建 list → URL 变 `/folder/<新id>`;重命名(双击)、删除(hover 垃圾桶)生效。
4. `/today` 加任务、勾选完成(toast "Task completed");重复任务勾选后 ~0.6s 重置并 toast "Recurring task reset"。
5. 点任务进 `/task/:id?list=...`;Back 回到来源列表;prev/next 在该列表内移动;刷新该 URL 不丢上下文。
6. 任务详情:编辑标题/notes/steps/资源、改 List/Priority/Status/Due/Repeat;Start 计时→侧边栏出现 Live Session;Pause/End(End 弹模态记备注);切换到另一任务 Start 会自动保存上一段。
7. `/calendar`:当前真实月份、今天高亮;点日期看详情;Connect Google Calendar(模拟 1.8s)后显示事件与冲突标记;日期格 + 号加任务。
8. AI Plan(`?panel=plan` 右侧抽屉)、AI Optimize(`?panel=optimize` 模态)模拟 loading→建议→接受/拒绝/精炼。
9. **持久化:** 刷新页面,任务/文件夹/会话保持;运行中的计时器刷新后继续。
10. 触发一次渲染错误无法手测时跳过;确认 ErrorBoundary 文件已就位(单测可选,不在本计划)。

- [ ] **Step 3: 记录结果**

把任何偏差记下来,用 superpowers:systematic-debugging 处理后再继续。全绿则本计划完成。

---

## Self-Review(规划者已执行)

- **Spec 覆盖:** 结构重组→T2–T16;路由→T15–T16;useReducer+Context→T7–T9;持久化→T6/T8/T9;消除重复(completeRecurringTask/createWorkSession/formatDate)→T4–T5;ErrorBoundary→T11;测试→T1/T4–T7。shadcn 替换/后端/部署/移除 @mui **明确不在 Phase 1**(spec 第 11 节),不在本计划。
- **类型/命名一致性:** `DataState`/`DataAction`/`taskReducer`/`initDataState`、`useTaskStore`/`useTimer`、`selectListTasks`/`isTodayTask`/`formatDuration`/`formatDate`、hooks API(`addTask`/`updateTask`/`toggleDone`/`deleteTask`/`startFocus`/`applyOptimization`)在各任务间一致引用。`Folder` 类型在用到 lucide `Folder` 图标的组件里别名为 `FolderType`。
- **行为变更已隔离:** 唯一可见变更=日历/`daysLeft` 改用真实今天(T13 Step 3、T4),其余迁移保持 JSX 原样。
- **占位符:** 组件迁移任务引用 `App.tsx` 精确行号 + 完整改动清单,新模块给出完整代码;无 TBD/TODO。
```
