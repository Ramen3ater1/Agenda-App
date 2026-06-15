# Agenda — Phase 1 重构地基 设计文档

**日期:** 2026-06-15
**范围:** 仅 Phase 1（重构地基）。shadcn/ui 全量替换、Express+SQLite 后端、部署文档为后续独立阶段。
**目标:** 把 1821 行单文件原型重构为可维护、可测试、可路由、可持久化的前端,**不改变可见 UI**(除下文明确的行为变更)。

---

## 1. 背景与现状

- 技术栈:React 18 + TypeScript + Vite + Tailwind v4 + `react-router` v7(已装未用)。
- 全部逻辑在 `src/app/App.tsx`(1821 行):14 个类型、2 个常量映射、6 组种子数据、9 个工具函数、9 个组件。
- 根组件 `App` 有 13 个 `useState` + 1 个 `useRef`,`TaskDetailPanel` 接收 18 个 props(props drilling)。
- 数据纯内存,刷新即丢;仅 `ff_onboarded` 用 localStorage。
- 模型已是 JSON 安全(所有日期为 ISO 字符串,无 `Date` 对象入库)。
- 无测试运行器、无 ESLint。`@` → `src` 别名已配置。

### 已确认的重复逻辑
- 重复任务完成→重置:`updateTask` 与 `toggleTaskDone` 各写一遍。
- 工作会话对象构造:`startTimer`(切换自动保存)与 `endSession` 各写一遍。
- 三个日期格式化:`fmtTime` / `fmtDate` / `fmtSessionDate`。

---

## 2. 关键决策(已与用户确认)

1. **任务详情路由:** 独立路由 `/task/:taskId?list=<today|all|calendar|folderId>`。`list` 查询参数保存 prev/next 与"返回"的上下文,URL 可收藏/分享、刷新不丢上下文。
2. **测试:** Phase 1 引入 **Vitest**,为纯逻辑(`lib/utils.ts` 全部函数 + reducer)写单元测试,作为重构安全网。
3. **"今天"日期:** **改用真实今天**(`new Date()`),不再硬编码 `2026-06-05`。这是有意的行为变更:围绕 6/5 策划的种子任务多数会变为"逾期"。集中到 `lib/utils.ts` 的 `today()` / `todayISO()`,calendar 高亮、`addTask` 默认截止日同步使用。

---

## 3. 目标目录结构

```
src/
├── types/index.ts            # 全部 14 个类型(5 别名 + 9 接口)
├── constants/index.ts        # PRIORITY_CFG, RECURRENCE_LABELS, 全部种子数据
├── lib/
│   ├── utils.ts              # uid, today/todayISO, formatDate, daysLeft,
│   │                         #   daysInMonth, firstDayOfMonth, advanceDeadline,
│   │                         #   completeRecurringTask, createWorkSession,
│   │                         #   generateOptimizations, sortTasks, isTodayTask
│   └── storage.ts            # 版本化 localStorage load/save
├── store/
│   ├── taskReducer.ts        # 纯 reducer + action 类型 + 初始 state 加载器
│   ├── TaskProvider.tsx      # useReducer + 持久化 effect + useTaskStore()
│   └── TimerProvider.tsx     # 独立计时 context(避免全局重渲染抖动)
├── hooks/
│   ├── useTimer.ts           # 区间(interval)计时逻辑
│   ├── useTasks.ts           # 任务 action creators + 重复/计时副作用编排
│   ├── useFolders.ts         # 文件夹 actions
│   └── useWorkspaces.ts      # 工作区/会话 actions
├── features/                 # 8 个功能文件夹,各默认导出 + index.ts barrel
│   ├── sidebar/Sidebar.tsx
│   ├── task-list/TaskListView.tsx
│   ├── task-detail/TaskDetailPanel.tsx
│   ├── calendar/CalendarView.tsx
│   ├── ai-optimize/AIOptimizeModal.tsx
│   ├── ai-plan/AIPlanPanel.tsx
│   ├── end-session/EndSessionModal.tsx
│   └── onboarding/OnboardingOverlay.tsx
├── components/ErrorBoundary.tsx
├── routes/
│   ├── Layout.tsx            # sidebar + <Outlet> + Toaster + 覆盖层 + onboarding
│   ├── ListRoute.tsx         # today / all / folder/:folderId(按参数切换标题与过滤)
│   ├── CalendarRoute.tsx
│   └── TaskRoute.tsx         # /task/:taskId 读取 ?list 上下文
├── app/App.tsx               # 仅 ErrorBoundary + Router + Providers + Routes(≤100 行)
└── main.tsx
```

`src/app/components/ui/`(shadcn 组件)Phase 1 原地保留,通过 `@/app/components/ui/*` 引用,Phase 2 再做全量替换与清理。

---

## 4. 状态管理:useReducer + 两个 Context

### TaskProvider(全局数据)
`useReducer` 管理 `{ tasks, folders, workspaces, gcalConnected }`。**reducer 保持纯函数。**

Action 类型:
`ADD_TASK` · `UPDATE_TASK` · `TOGGLE_TASK` · `RESET_RECURRING` · `DELETE_TASK` ·
`ADD_FOLDER` · `RENAME_FOLDER` · `DELETE_FOLDER` ·
`ENSURE_WORKSPACE` · `UPDATE_WORKSPACE` · `ADD_SESSION` ·
`APPLY_OPTIMIZATION` · `SET_GCAL`

### TimerProvider(瞬时计时)
独立 context,持有 `{ timerWorkspaceId, elapsed, running }` + interval。与全局数据隔离,避免每秒一次的全局重渲染。

### 副作用编排(hooks 层,非 reducer)
跨切面逻辑放在 `useTasks`:
- 标记完成 → 若计时器正运行于该任务的 workspace,则结束并保存会话(`createWorkSession`)。
- 重复任务完成 → 保留现有 ~500ms 延迟后 dispatch `RESET_RECURRING` + `toast`(先显示打勾再重置的 UX 不变)。
- `startFocus` → 必要时 `ENSURE_WORKSPACE` 再启动计时。

组件通过 `useTasks()/useFolders()/useWorkspaces()/useTimer()` 消费,消除 `TaskDetailPanel` 的 18-props drilling。

---

## 5. 路由(react-router v7)

| 路径 | 渲染 |
|---|---|
| `/` | 重定向 → `/today` |
| `/today` | `ListRoute`(过滤"今天") |
| `/all` | `ListRoute`(全部) |
| `/folder/:folderId` | `ListRoute`(按文件夹) |
| `/calendar` | `CalendarRoute` |
| `/task/:taskId?list=<ctx>` | `TaskRoute`(详情;`list` 决定 prev/next 与返回目标) |

- `Layout` = 侧边栏 + `<Outlet>` + `<Toaster>`;AI Plan / AI Optimize / End-Session / Onboarding 作为 `Layout` 内的**局部 UI 状态**(瞬时覆盖层,非可寻址视图)。
- 侧边栏导航用 `<NavLink>`;`activeList` 不再用 state,改由当前 URL 派生。
- 任务详情找不到(无效 `taskId`)→ 重定向 `/today` 并 toast 提示。

---

## 6. 持久化

- `lib/storage.ts`:版本化键 `agenda:v1`,提供 `loadState()` / `saveState(state)`,`try/catch` 容错。
- `TaskProvider` 用 `loadState() ?? 种子数据` 惰性初始化 reducer;数据变化时 `useEffect` 写穿(write-through)。
- 计时器状态(`{ workspaceId, running, startedAt, accumulated }`)单独持久化,使运行中的会话在刷新后可恢复。
- 模型全为 ISO 字符串,JSON 序列化无需特殊处理日期对象。

---

## 7. 消除重复(集中到 lib/utils.ts)

- `completeRecurringTask(task): Task` —— 推进截止日 + 重置步骤的唯一实现。
- `createWorkSession(date, duration, comment): WorkSession` —— 两条计时路径共用工厂。
- `formatDate(date, fmt)` —— 单一格式化器,`fmt: "short" | "session" | "duration"` 取代三个旧函数。

---

## 8. 错误处理与健壮性

- `components/ErrorBoundary.tsx`(class 组件)包裹 Router;fallback UI 含 **重试**(reset boundary)与 **重新加载** 两个动作。
- 模拟 AI / 日历同步异步操作保留 `loading` 标志,补 `try/catch`。
- 破坏性操作(删除任务、结束会话)保留确认提示(现有 `confirmDelete` 内联确认 + EndSession 模态)。

---

## 9. 测试(Vitest)

- 新增 devDeps:`vitest`、`jsdom`、`@testing-library/react`、`@testing-library/jest-dom`(reducer/utils 纯逻辑测试其实只需 `vitest`;RTL 留待将来组件测试)。
- `npm run test` 脚本。
- 纯逻辑单测:`advanceDeadline`、`completeRecurringTask`、`createWorkSession`、`generateOptimizations`、`sortTasks`、`daysLeft`、`isTodayTask`,以及 `taskReducer` 的每个 action。
- 注意:`daysLeft` / `today()` 依赖当前日期 → 测试中用固定注入日期或 `vi.useFakeTimers()` 保证确定性。

---

## 10. 行为保留契约(验收)

重构后以下行为必须与现状一致(除决策 #3 的"今天"变更):
1. 侧边栏 Today / All / Calendar 计数与文件夹计数逻辑不变。
2. 列表排序:未完成在前,再按优先级,再按截止日。
3. 任务勾选完成:步骤全勾、若计时运行则结束会话;重复任务延迟重置 + toast。
4. 计时器:切换 workspace 自动保存上一段("Auto-saved on switch");暂停/结束;End 模态记录备注。
5. 日历:任务截止日与(已连接的)Google 事件展示、冲突提示、点击日期加任务。
6. AI Optimize / AI Plan 的模拟 loading、建议生成、接受/拒绝/精炼交互不变。
7. Onboarding:`ff_onboarded` 未设置时首次显示,Skip/完成后写入。

**验收手段:** `npm run build` 通过 + `npm run test` 通过 + 手动跑应用核对上述 7 条。

---

## 11. 不在 Phase 1 范围

- shadcn/ui 替换原生元素、接入 `sonner` 封装、删除 `components/ui` 死代码 —— Phase 2。
- 移除 `@mui/*` 与 Emotion(已确认未被引用)—— Phase 2 清理。
- Express + SQLite 后端、`src/lib/api.ts`、Vite 代理、生产托管 —— Phase 3。
- 部署文档(Railway/Render + Vercel/Netlify)—— Phase 4。
