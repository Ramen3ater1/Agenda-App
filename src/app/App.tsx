import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Toaster, toast } from "sonner";
import {
  LayoutDashboard, ListTodo, CalendarDays, Brain,
  Plus, Play, Pause, Square, Link2, FileText, StickyNote,
  Star, ChevronLeft, ChevronRight, X, Check, Sparkles,
  RotateCcw, RefreshCcw, Trash2, ExternalLink,
  AlertTriangle, Lock, Zap, Upload, Minus, Settings,
  Repeat, Wand2, ArrowUpRight,
  Folder, FolderOpen,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = "critical" | "high" | "medium" | "low";
type TaskStatus = "todo" | "in-progress" | "done";
type AppView = "workspace" | "tasks" | "calendar" | "plan";
type ResourceType = "link" | "file" | "note";
type RecurrenceType = "none" | "daily" | "weekly" | "monthly";

interface TaskStep {
  id: string;
  title: string;
  done: boolean;
  workspaceId?: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  deadline: string;
  steps: TaskStep[];
  starred: boolean;
  workspaceId?: string;
  recurrence: RecurrenceType;
}

interface Resource {
  id: string;
  type: ResourceType;
  title: string;
  value: string;
}

interface WorkSession {
  id: string;
  date: string;
  duration: number;
  comment: string;
}

interface Workspace {
  id: string;
  name: string;
  taskId?: string;
  stepId?: string;
  resources: Resource[];
  sessions: WorkSession[];
}

interface GCalEvent {
  id: string;
  title: string;
  date: string;
  time: string;
}

interface PlanStep {
  id: string;
  title: string;
  description: string;
  context?: string;
  timeline: string;
  status: "pending" | "accepted" | "removed";
  refined?: boolean;
}

interface OptimizeSuggestion {
  id: string;
  title: string;
  description: string;
  tag: string;
  taskId: string;
  field: string;
  value: unknown;
  status: "pending" | "accepted" | "rejected";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_CFG: Record<Priority, { label: string; color: string; dot: string; bg: string; border: string }> = {
  critical: { label: "Critical", color: "text-red-600",    dot: "bg-red-500",    bg: "bg-red-50",    border: "border-red-200" },
  high:     { label: "High",     color: "text-orange-600", dot: "bg-orange-500", bg: "bg-orange-50", border: "border-orange-200" },
  medium:   { label: "Medium",   color: "text-amber-600",  dot: "bg-amber-400",  bg: "bg-amber-50",  border: "border-amber-200" },
  low:      { label: "Low",      color: "text-emerald-600",dot: "bg-emerald-500",bg: "bg-emerald-50",border: "border-emerald-200" },
};

const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  none:    "Does not repeat",
  daily:   "Daily",
  weekly:  "Weekly",
  monthly: "Monthly",
};

// ─── Initial Data ─────────────────────────────────────────────────────────────

const INIT_WORKSPACES: Workspace[] = [
  {
    id: "w1", name: "Portfolio Website Redesign", taskId: "t1",
    resources: [
      { id: "r1", type: "link", title: "Figma Design File", value: "figma.com/file/xyz123" },
      { id: "r2", type: "link", title: "Inspiration Board", value: "pinterest.com/board/abc" },
      { id: "r3", type: "file", title: "brand-guidelines.pdf", value: "" },
      { id: "r4", type: "note", title: "Tokens: #0D0D0B / #F8F8F6 / #3D5AFE", value: "" },
    ],
    sessions: [
      { id: "ses1", date: "2026-06-03", duration: 8100, comment: "Completed wireframes for mobile breakpoints. Struggling with the hero section — might try an asymmetric approach tomorrow." },
      { id: "ses2", date: "2026-06-04", duration: 2700, comment: "Quick review of brand guidelines. Typography feels tight — need to decide between serif display vs. geometric sans for headings." },
    ],
  },
  {
    id: "w2", name: "Q2 Performance Review", taskId: "t2",
    resources: [
      { id: "r5", type: "link", title: "Analytics Dashboard", value: "analytics.google.com" },
      { id: "r6", type: "note", title: "Focus on retention metrics and CAC", value: "" },
    ],
    sessions: [],
  },
  {
    id: "w3", name: "TypeScript Course", taskId: "t3",
    resources: [
      { id: "r7", type: "link", title: "Course Link", value: "udemy.com/typescript-advanced" },
    ],
    sessions: [
      { id: "ses3", date: "2026-05-28", duration: 5400, comment: "Set up practice environment, started generics chapter." },
    ],
  },
  { id: "w4", name: "Team Offsite Planning", taskId: "t4", resources: [], sessions: [] },
  {
    id: "w5", name: "API Rate Limiting", taskId: "t5",
    resources: [{ id: "r8", type: "link", title: "Redis Rate Limit Docs", value: "redis.io/docs/manual/patterns" }],
    sessions: [],
  },
];

const INIT_TASKS: Task[] = [
  {
    id: "t1", title: "Portfolio Website Redesign",
    description: "Complete redesign with updated branding and Next.js 14 implementation.",
    priority: "high", status: "in-progress", deadline: "2026-06-20", starred: true,
    workspaceId: "w1", recurrence: "none",
    steps: [
      { id: "s1a", title: "Define scope and gather inspiration", done: true },
      { id: "s1b", title: "Create wireframes for key pages", done: true },
      { id: "s1c", title: "Design full layouts in Figma", done: false },
      { id: "s1d", title: "Develop with Next.js 14", done: false },
      { id: "s1e", title: "Deploy and test on Vercel", done: false },
    ],
  },
  {
    id: "t2", title: "Q2 Performance Review Presentation",
    description: "Quarterly metrics and team performance analysis for leadership team.",
    priority: "critical", status: "todo", deadline: "2026-06-08", starred: true,
    workspaceId: "w2", recurrence: "none",
    steps: [
      { id: "s2a", title: "Pull metrics from analytics dashboard", done: false },
      { id: "s2b", title: "Draft key insights and recommendations", done: false },
      { id: "s2c", title: "Create slide deck in Google Slides", done: false },
      { id: "s2d", title: "Practice presentation (15 min target)", done: false },
    ],
  },
  {
    id: "t3", title: "Advanced TypeScript Course",
    description: "Complete advanced TypeScript patterns, generics, and decorators modules.",
    priority: "medium", status: "in-progress", deadline: "2026-07-15", starred: false,
    workspaceId: "w3", recurrence: "weekly",
    steps: [
      { id: "s3a", title: "Set up practice environment", done: true },
      { id: "s3b", title: "Complete generics module (ch. 4–7)", done: false },
      { id: "s3c", title: "Complete decorators module (ch. 8–10)", done: false },
      { id: "s3d", title: "Build capstone project", done: false },
    ],
  },
  {
    id: "t4", title: "Team Offsite Planning",
    description: "Organize Q3 two-day offsite for the 12-person product team.",
    priority: "low", status: "todo", deadline: "2026-06-25", starred: false,
    workspaceId: "w4", recurrence: "none",
    steps: [
      { id: "s4a", title: "Research and book venue", done: false },
      { id: "s4b", title: "Send calendar invites to all attendees", done: false },
      { id: "s4c", title: "Prepare agenda and activities", done: false },
    ],
  },
  {
    id: "t5", title: "API Rate Limiting Implementation",
    description: "Redis-based rate limiting middleware for the public REST API.",
    priority: "high", status: "todo", deadline: "2026-06-12", starred: false,
    workspaceId: "w5", recurrence: "none",
    steps: [
      { id: "s5a", title: "Research Redis rate limiting patterns", done: false },
      { id: "s5b", title: "Write middleware implementation", done: false },
      { id: "s5c", title: "Add comprehensive test suite", done: false },
      { id: "s5d", title: "Deploy to staging for QA sign-off", done: false },
    ],
  },
];

const GCAL_EVENTS: GCalEvent[] = [
  { id: "e1", title: "Team Standup",     date: "2026-06-08", time: "9:00 AM" },
  { id: "e2", title: "1:1 with Manager", date: "2026-06-10", time: "2:00 PM" },
  { id: "e3", title: "Sprint Planning",  date: "2026-06-15", time: "10:00 AM" },
  { id: "e4", title: "Design Review",    date: "2026-06-20", time: "3:00 PM" },
  { id: "e5", title: "All-Hands Meeting",date: "2026-06-12", time: "11:00 AM" },
  { id: "e6", title: "Product Demo",     date: "2026-06-25", time: "1:00 PM" },
];

const PLAN_TEMPLATE: PlanStep[] = [
  {
    id: "p1", timeline: "Start immediately",
    title: "Establish a consistent deep-work routine",
    description: "Block 3 focused hours each morning (9–12) for high-priority work. Your recent sessions show your most productive output comes from focused, shorter bursts — not marathon sessions.",
    context: "Based on your 2 logged sessions: both show quality notes from sub-3-hour blocks.",
    status: "pending",
  },
  {
    id: "p2", timeline: "June 5–20",
    title: "Clear the June backlog before adding anything new",
    description: "You have 3 high/critical tasks due before June 20. Finish these before starting anything new — particularly the Q2 Review (June 8) and API Rate Limiting (June 12).",
    context: "Conflict detected: 'Design Review' calendar event on June 20 overlaps with the Portfolio deadline.",
    status: "pending",
  },
  {
    id: "p3", timeline: "Weekly through July 15",
    title: "Build a weekly TypeScript learning cadence",
    description: "Dedicate one 2-hour session per week to the TypeScript course. At this pace you will finish exactly on deadline — with no heroics needed.",
    context: "You have completed 1 of 4 course steps. One focused session per week closes the gap by July 15.",
    status: "pending",
  },
  {
    id: "p4", timeline: "Months 1–2",
    title: "Turn the Portfolio project into public proof of work",
    description: "Document your design and development process in public as you build. One internal project becomes ongoing marketing material.",
    context: "Your starred tasks and Figma/Next.js stack suggest you are building toward a design-engineering positioning.",
    status: "pending",
  },
  {
    id: "p5", timeline: "Before June 10",
    title: "Delegate or descope the Team Offsite",
    description: "The offsite is your lowest-priority task but has three open steps. Consider delegating venue research, or trimming the offsite to a single day.",
    context: "You have 4 higher-priority tasks with earlier deadlines. The offsite is not due until June 25.",
    status: "pending",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 9); }

function fmtTime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtSessionDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function daysLeft(d: string) {
  const today = new Date("2026-06-05");
  return Math.ceil((new Date(d + "T00:00:00").getTime() - today.getTime()) / 86400000);
}

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function firstDayOfMonth(y: number, m: number) { return new Date(y, m, 1).getDay(); }

function advanceDeadline(deadline: string, recurrence: RecurrenceType): string {
  const d = new Date(deadline + "T00:00:00");
  if (recurrence === "daily") d.setDate(d.getDate() + 1);
  else if (recurrence === "weekly") d.setDate(d.getDate() + 7);
  else if (recurrence === "monthly") d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function generateOptimizations(tasks: Task[]): OptimizeSuggestion[] {
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
    if (t.priority === "critical" && !t.starred) {
      suggestions.push({
        id: uid(), tag: "Visibility", taskId: t.id, field: "starred", value: true,
        title: `Star "${t.title}"`,
        description: "Critical tasks should be starred so they always appear at the top of your list.",
        status: "pending",
      });
    }
  });
  return suggestions.slice(0, 5);
}

// ─── EndSessionModal ──────────────────────────────────────────────────────────

function EndSessionModal({ elapsed, onSave, onCancel }: {
  elapsed: number;
  onSave: (comment: string) => void;
  onCancel: () => void;
}) {
  const [comment, setComment] = useState("");
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
        className="bg-card rounded-xl border border-border w-[440px] shadow-2xl p-6"
      >
        <h3 className="text-base font-semibold mb-0.5">End Session</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Duration: <span className="font-mono font-medium text-foreground">{fmtTime(elapsed)}</span>
        </p>
        <label className="text-xs font-medium block mb-1.5">Session notes</label>
        <textarea
          autoFocus
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="What did you accomplish? Any blockers or observations?"
          rows={4}
          className="w-full px-3 py-2.5 border border-border rounded-md text-sm bg-background resize-none outline-none focus:ring-2 focus:ring-accent/30"
        />
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onSave(comment)}
            className="flex-1 py-2 bg-foreground text-background rounded-md text-sm font-medium hover:opacity-90"
          >
            Save &amp; End
          </button>
          <button onClick={onCancel} className="px-4 py-2 border border-border rounded-md text-sm hover:bg-secondary">
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ activeView, setActiveView, timerRunning, timerDisplay, timerTaskName, gcalConnected }: {
  activeView: AppView;
  setActiveView: (v: AppView) => void;
  timerRunning: boolean;
  timerDisplay: string;
  timerTaskName: string;
  gcalConnected: boolean;
}) {
  const navItem = (view: AppView, icon: React.ReactNode, label: string, opts?: { hero?: boolean; sub?: string }) => {
    const isActive = activeView === view;
    return (
      <button
        key={view}
        onClick={() => setActiveView(view)}
        className={`w-full flex items-center gap-3 px-3 rounded-md text-sm transition-colors ${
          opts?.hero ? "py-3 font-medium" : "py-2.5"
        } ${
          isActive
            ? "bg-accent text-white"
            : "text-[#9E9E9C] hover:bg-sidebar-accent hover:text-sidebar-foreground"
        }`}
      >
        {icon}
        <span className="flex-1 text-left flex flex-col leading-tight">
          <span>{label}</span>
          {opts?.sub && (
            <span className={`text-[10px] ${isActive ? "text-white/70" : "text-[#6B6B68]"}`}>{opts.sub}</span>
          )}
        </span>
      </button>
    );
  };
  const groupHeading = "px-3 pt-4 pb-1.5 text-[10px] uppercase tracking-[0.12em] text-[#6B6B68] font-semibold select-none";
  return (
    <aside className="w-[220px] shrink-0 bg-sidebar flex flex-col h-screen sticky top-0">
      <div className="px-5 pt-6 pb-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded bg-accent flex items-center justify-center">
            <Zap size={13} className="text-white" />
          </div>
          <span className="text-sidebar-foreground font-semibold text-[15px] tracking-tight">FocusFlow</span>
        </div>
        <p className="text-[11px] text-[#6B6B68] mt-2 leading-snug">Plan it. Start it. Resume in seconds.</p>
      </div>
      <nav className="flex-1 px-2.5 py-2 overflow-y-auto">
        {navItem("workspace", <LayoutDashboard size={18} />, "Workspace", { hero: true })}

        <div className={groupHeading}>Views</div>
        {navItem("tasks", <ListTodo size={16} />, "Tasks")}
        {navItem("calendar", <CalendarDays size={16} />, "Calendar", { sub: gcalConnected ? "Google synced" : "Connect Google" })}

        <div className={groupHeading}>Assistant</div>
        {navItem("plan", <Brain size={16} />, "AI Plan")}
      </nav>
      {timerRunning && (
        <div className="mx-2.5 mb-3 px-3.5 py-3 rounded-md bg-sidebar-accent border border-sidebar-border">
          <div className="text-[9px] uppercase tracking-widest text-[#6B6B68] font-mono mb-1.5">Live Session</div>
          <div className="font-mono text-sidebar-foreground text-xl font-medium tracking-tight">{timerDisplay}</div>
          <div className="text-[11px] text-[#6B6B68] truncate mt-1">{timerTaskName}</div>
          <div className="flex items-center gap-1 mt-2">
            <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-emerald-400">Recording</span>
          </div>
        </div>
      )}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-full bg-accent/20 flex items-center justify-center text-xs font-semibold text-accent">A</div>
          <div>
            <div className="text-sidebar-foreground text-xs font-medium">Alex Kim</div>
            <div className="text-[#6B6B68] text-[11px]">Free Plan</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── WorkspaceExplorer ───────────────────────────────────────────────────────

function WorkspaceExplorer({
  tasks, workspaces, activeWorkspaceId, timerWorkspaceId, onSelect,
}: {
  tasks: Task[];
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  timerWorkspaceId: string | null;
  onSelect: (wsId: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(tasks.map(t => t.id))
  );

  function toggle(taskId: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  }

  return (
    <div className="w-[260px] shrink-0 border-r border-sidebar-border flex flex-col bg-sidebar h-full overflow-hidden">
      <div className="px-3 py-2 border-b border-sidebar-border flex items-center justify-between shrink-0">
        <span className="text-[10px] uppercase tracking-[0.12em] text-[#6B6B68] font-semibold select-none">
          Explorer — Workspaces
        </span>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {tasks.map(task => {
          const taskWs = task.workspaceId
            ? workspaces.find(w => w.id === task.workspaceId)
            : null;
          const stepWsList = task.steps
            .filter(s => s.workspaceId)
            .map(s => ({ step: s, ws: workspaces.find(w => w.id === s.workspaceId)! }))
            .filter(sw => sw.ws);
          const hasChildren = stepWsList.length > 0;
          const isOpen = expanded.has(task.id);
          const isActive = taskWs ? activeWorkspaceId === taskWs.id : false;
          const isRecording = taskWs ? timerWorkspaceId === taskWs.id : false;

          return (
            <div key={task.id}>
              {/* Task row */}
              <div
                onClick={() => taskWs && onSelect(taskWs.id)}
                className={`group flex items-center gap-0.5 h-[22px] px-1 cursor-pointer select-none transition-colors ${
                  isActive
                    ? "bg-accent/25 text-sidebar-foreground"
                    : "text-[#BBBBBA] hover:bg-sidebar-accent hover:text-sidebar-foreground"
                } ${!taskWs ? "opacity-50 cursor-default" : ""}`}
              >
                <button
                  onClick={e => { e.stopPropagation(); if (hasChildren) toggle(task.id); }}
                  className="size-4 flex items-center justify-center shrink-0 text-[#555553]"
                >
                  {hasChildren ? (
                    <ChevronRight
                      size={10}
                      className={`transition-transform duration-100 ${isOpen ? "rotate-90" : ""}`}
                    />
                  ) : (
                    <span className="w-[10px]" />
                  )}
                </button>
                {isOpen && hasChildren
                  ? <FolderOpen size={14} className="shrink-0 text-amber-400" />
                  : <Folder size={14} className={`shrink-0 ${hasChildren || taskWs ? "text-amber-400" : "text-[#555553]"}`} />
                }
                <span className="text-[12.5px] ml-1.5 truncate flex-1 leading-none">{task.title}</span>
                {isRecording && (
                  <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0 mr-1" />
                )}
              </div>

              {/* Step workspaces */}
              {isOpen && stepWsList.map(({ step, ws }) => {
                const isStepActive = activeWorkspaceId === ws.id;
                const isStepRecording = timerWorkspaceId === ws.id;
                return (
                  <div
                    key={step.id}
                    onClick={() => onSelect(ws.id)}
                    className={`flex items-center gap-1 h-[22px] pl-[38px] pr-2 cursor-pointer select-none transition-colors ${
                      isStepActive
                        ? "bg-accent/25 text-sidebar-foreground"
                        : "text-[#9E9E9C] hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    }`}
                  >
                    <FileText size={12} className="shrink-0" />
                    <span className="text-[12px] ml-1 truncate flex-1 leading-none">{step.title}</span>
                    {isStepRecording && (
                      <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── WorkspaceView ────────────────────────────────────────────────────────────

function WorkspaceView({
  workspaces, setWorkspaces, tasks,
  activeWorkspaceId, setActiveWorkspaceId,
  timerElapsed, timerRunning, timerWorkspaceId,
  onStart, onPause, onRequestEnd,
}: {
  workspaces: Workspace[];
  setWorkspaces: React.Dispatch<React.SetStateAction<Workspace[]>>;
  tasks: Task[];
  activeWorkspaceId: string;
  setActiveWorkspaceId: (id: string) => void;
  timerElapsed: number;
  timerRunning: boolean;
  timerWorkspaceId: string | null;
  onStart: (workspaceId: string) => void;
  onPause: () => void;
  onRequestEnd: (workspaceId: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [addingRes, setAddingRes] = useState(false);
  const [newRes, setNewRes] = useState({ type: "link" as ResourceType, title: "", value: "" });
  const [resuming, setResuming] = useState(false);

  const allWorkspaces = workspaces.filter(w => w.taskId);
  const workspace = workspaces.find(w => w.id === activeWorkspaceId) ?? allWorkspaces[0];
  if (!workspace) return null;

  // Breadcrumb: task workspace or step workspace
  const linkedTask = tasks.find(t => t.workspaceId === workspace.id);
  const linkedStep = !linkedTask
    ? tasks.flatMap(t => t.steps).find(s => s.workspaceId === workspace.id)
    : null;
  const linkedStepTask = linkedStep
    ? tasks.find(t => t.steps.some(s => s.id === linkedStep.id))
    : null;

  const isThisTimerRunning = timerRunning && timerWorkspaceId === workspace.id;
  const effectiveElapsed = isThisTimerRunning ? timerElapsed : 0;
  const totalTime = workspace.sessions.reduce((a, s) => a + s.duration, 0) + effectiveElapsed;

  // Workspace whose most recent session is the latest of all — for "Resume last session".
  const lastSessionWs = allWorkspaces
    .filter(w => w.sessions.length > 0)
    .map(w => ({ w, last: w.sessions.reduce((a, s) => (s.date > a ? s.date : a), "") }))
    .sort((a, b) => b.last.localeCompare(a.last))[0]?.w;

  function resumeLastSession() {
    if (!lastSessionWs) return;
    setResuming(true);
    setActiveWorkspaceId(lastSessionWs.id);
    onStart(lastSessionWs.id);
    setTimeout(() => setResuming(false), 1200);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    const url = e.dataTransfer.getData("URL") || e.dataTransfer.getData("text/uri-list");
    const text = e.dataTransfer.getData("text");
    const newResource = url
      ? { id: uid(), type: "link" as ResourceType, title: url.slice(0, 50), value: url }
      : text
        ? { id: uid(), type: "note" as ResourceType, title: text.slice(0, 60), value: text }
        : { id: uid(), type: "file" as ResourceType, title: "Dropped file", value: "" };
    setWorkspaces(ws => ws.map(w => w.id === workspace.id ? { ...w, resources: [...w.resources, newResource] } : w));
  }

  function addResource() {
    if (!newRes.title.trim()) return;
    setWorkspaces(ws => ws.map(w => w.id === workspace.id ? { ...w, resources: [...w.resources, { id: uid(), ...newRes }] } : w));
    setNewRes({ type: "link", title: "", value: "" });
    setAddingRes(false);
  }

  function removeResource(rid: string) {
    setWorkspaces(ws => ws.map(w => w.id === workspace.id ? { ...w, resources: w.resources.filter(r => r.id !== rid) } : w));
  }

  const resIcon = (t: ResourceType) =>
    t === "link" ? <Link2 size={13} /> : t === "file" ? <FileText size={13} /> : <StickyNote size={13} />;

  return (
    <div className="flex-1 flex h-screen overflow-hidden">
      {/* Left: VSCode-style explorer */}
      <WorkspaceExplorer
        tasks={tasks}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        timerWorkspaceId={timerWorkspaceId}
        onSelect={setActiveWorkspaceId}
      />

      {/* Right: detail panel */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header with breadcrumb */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0 min-h-[57px]">
          <div className="flex items-center gap-1.5 min-w-0 text-sm">
            {linkedStepTask ? (
              <>
                <span className="text-muted-foreground truncate max-w-[160px]">{linkedStepTask.title}</span>
                <ChevronRight size={13} className="text-muted-foreground shrink-0" />
                <span className="font-medium truncate">{linkedStep?.title}</span>
              </>
            ) : linkedTask ? (
              <span className="font-medium truncate">{linkedTask.title}</span>
            ) : (
              <span className="font-medium truncate">{workspace.name}</span>
            )}
            {isThisTimerRunning && (
              <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse ml-2 shrink-0" />
            )}
          </div>
        </div>

        {/* Quick-start bar — plan, start, and resume in one click */}
        <div className="px-6 py-2.5 border-b border-border flex items-center gap-2 shrink-0 bg-card/40">
          <span className="text-[11px] text-muted-foreground mr-1 hidden sm:inline">Quick start</span>
          {!isThisTimerRunning ? (
            <button
              onClick={() => onStart(workspace.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-foreground text-background hover:opacity-90 transition-opacity shrink-0"
            >
              <Play size={11} fill="currentColor" /> Start session
            </button>
          ) : (
            <button
              onClick={onPause}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border text-foreground hover:bg-secondary transition-colors shrink-0"
            >
              <Pause size={11} /> Pause
            </button>
          )}
          {lastSessionWs && (
            <button
              onClick={resumeLastSession}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border font-medium transition-all shrink-0 ${
                resuming ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              <RotateCcw size={11} className={resuming ? "animate-spin" : ""} />
              {resuming ? "Resuming…" : `Resume last session${lastSessionWs.id !== workspace.id ? ` · ${lastSessionWs.name}` : ""}`}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 grid grid-cols-[1fr_280px] gap-5 min-h-full">
            {/* Left column */}
            <div className="space-y-4">
              {/* Timer card */}
              <div className="bg-card rounded-lg border border-border p-5">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-3">Session Timer</div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="font-mono text-4xl font-medium tracking-tight text-foreground leading-none">
                      {fmtTime(effectiveElapsed)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2 font-mono">
                      Total logged: {fmtTime(totalTime)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isThisTimerRunning ? (
                      <button
                        onClick={() => onStart(workspace.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                      >
                        <Play size={13} fill="currentColor" /> Start
                      </button>
                    ) : (
                      <button
                        onClick={onPause}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 rounded-md text-sm font-medium hover:bg-amber-200 transition-colors"
                      >
                        <Pause size={13} fill="currentColor" /> Pause
                      </button>
                    )}
                    {isThisTimerRunning && (
                      <button
                        onClick={() => onRequestEnd(workspace.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-secondary text-foreground rounded-md text-sm font-medium hover:bg-muted transition-colors"
                      >
                        <Square size={13} /> End
                      </button>
                    )}
                  </div>
                </div>
                {isThisTimerRunning && (
                  <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-border text-xs text-emerald-600">
                    <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Session active — all changes are saved continuously
                  </div>
                )}
              </div>

              {/* Resources */}
              <div className="bg-card rounded-lg border border-border overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                  <h2 className="text-sm font-medium">Resources</h2>
                  <button onClick={() => setAddingRes(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Plus size={12} /> Add
                  </button>
                </div>
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`mx-4 my-3 border-2 border-dashed rounded-md py-4 flex flex-col items-center gap-1.5 transition-colors ${dragOver ? "border-accent bg-accent/5" : "border-border"}`}
                >
                  <Upload size={14} className={dragOver ? "text-accent" : "text-muted-foreground"} />
                  <span className="text-xs text-muted-foreground">{dragOver ? "Release to add" : "Drag files, links, or text here"}</span>
                </div>
                {addingRes && (
                  <div className="mx-4 mb-3 p-3 bg-secondary rounded-md space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={newRes.type}
                        onChange={e => setNewRes(r => ({ ...r, type: e.target.value as ResourceType }))}
                        className="text-xs border border-border rounded px-2 py-1.5 bg-card"
                      >
                        <option value="link">Link</option>
                        <option value="file">File</option>
                        <option value="note">Note</option>
                      </select>
                      <input
                        autoFocus value={newRes.title}
                        onChange={e => setNewRes(r => ({ ...r, title: e.target.value }))}
                        onKeyDown={e => e.key === "Enter" && addResource()}
                        placeholder="Title or URL"
                        className="flex-1 text-xs border border-border rounded px-2.5 py-1.5 bg-card outline-none focus:ring-1 focus:ring-accent/40"
                      />
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={addResource} className="text-xs px-3 py-1.5 bg-foreground text-background rounded font-medium">Add</button>
                      <button onClick={() => setAddingRes(false)} className="text-xs px-3 py-1.5 border border-border rounded hover:bg-muted">Cancel</button>
                    </div>
                  </div>
                )}
                <div className="px-4 pb-4 space-y-1.5">
                  {workspace.resources.map(r => (
                    <div key={r.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-md group transition-all ${resuming ? "bg-accent/8 ring-1 ring-accent/20" : "bg-secondary hover:bg-muted"}`}>
                      <span className="text-muted-foreground shrink-0">{resIcon(r.type)}</span>
                      <span className="text-sm flex-1 truncate">{r.title}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {r.type === "link" && <button className="p-1 text-muted-foreground hover:text-foreground"><ExternalLink size={11} /></button>}
                        <button onClick={() => removeResource(r.id)} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 size={11} /></button>
                      </div>
                    </div>
                  ))}
                  {workspace.resources.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No resources yet.</p>}
                </div>
              </div>
            </div>

            {/* Right column: Sessions */}
            <div>
              <div className="bg-card rounded-lg border border-border overflow-hidden sticky top-0">
                <div className="px-5 py-3.5 border-b border-border">
                  <h2 className="text-sm font-medium">Session History</h2>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {workspace.sessions.length} sessions · {fmtTime(workspace.sessions.reduce((a, s) => a + s.duration, 0))} total
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {[...workspace.sessions].reverse().map(s => (
                    <div key={s.id} className="border border-border rounded-md p-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] text-muted-foreground">{fmtSessionDate(s.date)}</span>
                        <span className="font-mono text-xs text-foreground font-medium">{fmtTime(s.duration)}</span>
                      </div>
                      {s.comment && <p className="text-xs text-foreground leading-relaxed">{s.comment}</p>}
                    </div>
                  ))}
                  {workspace.sessions.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">No sessions yet. Start your first session!</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TaskSettingsPanel ────────────────────────────────────────────────────────

function TaskSettingsPanel({
  task, workspace, workspaces,
  onUpdateTask, onUpdateWorkspace, onCreateWorkspace,
  onCreateStepWorkspace, onRemoveStepWorkspace,
  onDeleteTask, onOpenWorkspace, onClose,
}: {
  task: Task;
  workspace?: Workspace;
  workspaces: Workspace[];
  onUpdateTask: (updates: Partial<Task>) => void;
  onUpdateWorkspace: (wsId: string, updates: Partial<Workspace>) => void;
  onCreateWorkspace: () => void;
  onCreateStepWorkspace: (stepId: string) => void;
  onRemoveStepWorkspace: (stepId: string, wsId: string) => void;
  onDeleteTask: () => void;
  onOpenWorkspace: (wsId: string) => void;
  onClose: () => void;
}) {
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [stepTitle, setStepTitle] = useState("");
  const [newStepTitle, setNewStepTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  function startEditStep(step: TaskStep) {
    setEditingStepId(step.id);
    setStepTitle(step.title);
  }

  function saveStepTitle(stepId: string) {
    if (stepTitle.trim()) {
      onUpdateTask({ steps: task.steps.map(s => s.id === stepId ? { ...s, title: stepTitle.trim() } : s) });
    }
    setEditingStepId(null);
  }

  function addStep() {
    if (!newStepTitle.trim()) return;
    onUpdateTask({ steps: [...task.steps, { id: uid(), title: newStepTitle.trim(), done: false }] });
    setNewStepTitle("");
  }

  function removeStep(stepId: string) {
    onUpdateTask({ steps: task.steps.filter(s => s.id !== stepId) });
  }

  function addWsResource(resource: Resource) {
    if (!workspace) return;
    onUpdateWorkspace(workspace.id, { resources: [...workspace.resources, resource] });
  }

  function removeWsResource(rid: string) {
    if (!workspace) return;
    onUpdateWorkspace(workspace.id, { resources: workspace.resources.filter(r => r.id !== rid) });
  }

  const resIcon = (t: ResourceType) =>
    t === "link" ? <Link2 size={11} /> : t === "file" ? <FileText size={11} /> : <StickyNote size={11} />;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-start gap-3">
        <input
          value={task.title}
          onChange={e => onUpdateTask({ title: e.target.value })}
          className="flex-1 text-base font-semibold bg-transparent outline-none focus:bg-secondary/50 rounded px-1 -mx-1 py-0.5"
        />
        <button onClick={onClose} className="shrink-0 p-1.5 hover:bg-secondary rounded-md text-muted-foreground mt-0.5">
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Details section */}
        <div className="px-6 py-4 space-y-3 border-b border-border">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Details</div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Description</label>
            <textarea
              value={task.description}
              onChange={e => onUpdateTask({ description: e.target.value })}
              rows={3}
              placeholder="Add context or acceptance criteria…"
              className="w-full px-2.5 py-2 border border-border rounded-md text-sm bg-background resize-none outline-none focus:ring-1 focus:ring-accent/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Priority</label>
              <select
                value={task.priority}
                onChange={e => onUpdateTask({ priority: e.target.value as Priority })}
                className="w-full px-2.5 py-1.5 border border-border rounded-md text-sm bg-background outline-none focus:ring-1 focus:ring-accent/30"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Status</label>
              <select
                value={task.status}
                onChange={e => onUpdateTask({ status: e.target.value as TaskStatus })}
                className="w-full px-2.5 py-1.5 border border-border rounded-md text-sm bg-background outline-none focus:ring-1 focus:ring-accent/30"
              >
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Deadline</label>
              <input
                type="date" value={task.deadline}
                onChange={e => onUpdateTask({ deadline: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-border rounded-md text-sm bg-background outline-none focus:ring-1 focus:ring-accent/30"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Recurrence</label>
              <select
                value={task.recurrence}
                onChange={e => onUpdateTask({ recurrence: e.target.value as RecurrenceType })}
                className="w-full px-2.5 py-1.5 border border-border rounded-md text-sm bg-background outline-none focus:ring-1 focus:ring-accent/30"
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>

          <button
            onClick={() => onUpdateTask({ starred: !task.starred })}
            className={`flex items-center gap-2 text-sm transition-colors ${task.starred ? "text-amber-500" : "text-muted-foreground hover:text-amber-500"}`}
          >
            <Star size={14} fill={task.starred ? "currentColor" : "none"} />
            {task.starred ? "Starred" : "Mark as starred"}
          </button>
        </div>

        {/* Workspace section */}
        <div className="px-6 py-4 border-b border-border space-y-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Workspace</div>
          {workspace ? (
            <>
              <div className="flex items-center gap-2">
                <input
                  value={workspace.name}
                  onChange={e => onUpdateWorkspace(workspace.id, { name: e.target.value })}
                  className="flex-1 px-2.5 py-1.5 border border-border rounded-md text-sm bg-background outline-none focus:ring-1 focus:ring-accent/30"
                />
                <button
                  onClick={() => onOpenWorkspace(workspace.id)}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 border border-border rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <ArrowUpRight size={11} /> Open
                </button>
              </div>
              {/* Mini resources list */}
              <div className="space-y-1">
                {workspace.resources.map(r => (
                  <div key={r.id} className="flex items-center gap-2 px-2 py-1.5 bg-secondary rounded group">
                    <span className="text-muted-foreground">{resIcon(r.type)}</span>
                    <span className="text-xs flex-1 truncate">{r.title}</span>
                    <button onClick={() => removeWsResource(r.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all">
                      <X size={10} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addWsResource({ id: uid(), type: "note", title: "New note", value: "" })}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
                >
                  <Plus size={10} /> Add resource
                </button>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {workspace.sessions.length} sessions logged · {fmtTime(workspace.sessions.reduce((a, s) => a + s.duration, 0))} total
              </div>
            </>
          ) : (
            <button
              onClick={onCreateWorkspace}
              className="flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-md text-sm text-muted-foreground hover:border-accent hover:text-accent transition-colors w-full"
            >
              <Plus size={13} /> Initialize workspace for this task
            </button>
          )}
        </div>

        {/* Steps section */}
        <div className="px-6 py-4 border-b border-border space-y-2">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-3">Steps</div>
          {task.steps.map(step => {
            const stepWs = step.workspaceId ? workspaces.find(w => w.id === step.workspaceId) : undefined;
            return (
              <div key={step.id} className="space-y-1">
                <div className="flex items-center gap-2 group">
                  <div
                    onClick={() => onUpdateTask({ steps: task.steps.map(s => s.id === step.id ? { ...s, done: !s.done } : s) })}
                    className={`shrink-0 size-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${step.done ? "bg-accent border-accent" : "border-border hover:border-foreground/40"}`}
                  >
                    {step.done && <Check size={9} className="text-white" />}
                  </div>
                  {editingStepId === step.id ? (
                    <input
                      autoFocus value={stepTitle}
                      onChange={e => setStepTitle(e.target.value)}
                      onBlur={() => saveStepTitle(step.id)}
                      onKeyDown={e => e.key === "Enter" && saveStepTitle(step.id)}
                      className="flex-1 text-sm px-1.5 py-0.5 border border-border rounded outline-none focus:ring-1 focus:ring-accent/30 bg-background"
                    />
                  ) : (
                    <span
                      onClick={() => startEditStep(step)}
                      className={`flex-1 text-sm cursor-text ${step.done ? "line-through text-muted-foreground" : ""}`}
                    >
                      {step.title}
                    </span>
                  )}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => step.workspaceId ? onRemoveStepWorkspace(step.id, step.workspaceId) : onCreateStepWorkspace(step.id)}
                      title={step.workspaceId ? "Remove step workspace" : "Add step workspace"}
                      className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${step.workspaceId ? "border-accent/30 text-accent bg-accent/5" : "border-border text-muted-foreground hover:border-accent hover:text-accent"}`}
                    >
                      WS
                    </button>
                    <button onClick={() => removeStep(step.id)} className="text-muted-foreground hover:text-red-500 p-0.5">
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
                {stepWs && (
                  <div className="ml-6 flex items-center gap-2 px-2 py-1.5 bg-accent/5 border border-accent/15 rounded text-[11px] text-accent">
                    <LayoutDashboard size={10} />
                    <span className="flex-1 truncate">{stepWs.name}</span>
                    <button onClick={() => onOpenWorkspace(stepWs.id)} className="hover:underline">Open →</button>
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex items-center gap-2 mt-2">
            <div className="size-4 shrink-0 rounded border border-dashed border-border" />
            <input
              value={newStepTitle}
              onChange={e => setNewStepTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addStep()}
              placeholder="Add step…"
              className="flex-1 text-sm text-muted-foreground bg-transparent outline-none placeholder:text-muted-foreground/50"
            />
            {newStepTitle.trim() && (
              <button onClick={addStep} className="text-xs text-accent hover:opacity-80">Add</button>
            )}
          </div>
        </div>

        {/* Delete */}
        <div className="px-6 py-4">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600 flex-1">Delete this task permanently?</span>
              <button onClick={onDeleteTask} className="text-xs px-2.5 py-1.5 bg-red-500 text-white rounded font-medium">Delete</button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs px-2.5 py-1.5 border border-border rounded">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 transition-colors"
            >
              <Trash2 size={12} /> Delete task
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AIOptimizeModal ──────────────────────────────────────────────────────────

function AIOptimizeModal({ tasks, onApply, onClose }: {
  tasks: Task[];
  onApply: (taskId: string, field: string, value: unknown) => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<OptimizeSuggestion[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(false);
      setSuggestions(generateOptimizations(tasks));
    }, 2200);
    return () => clearTimeout(t);
  }, []);

  function accept(s: OptimizeSuggestion) {
    setSuggestions(ss => ss.map(x => x.id === s.id ? { ...x, status: "accepted" } : x));
    onApply(s.taskId, s.field, s.value);
    toast.success("Optimization applied");
  }

  function reject(id: string) {
    setSuggestions(ss => ss.map(x => x.id === id ? { ...x, status: "rejected" } : x));
  }

  const tagColors: Record<string, string> = {
    Priority: "bg-red-50 text-red-700 border-red-200",
    Status: "bg-blue-50 text-blue-700 border-blue-200",
    Visibility: "bg-amber-50 text-amber-700 border-amber-200",
    Deadline: "bg-purple-50 text-purple-700 border-purple-200",
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-card rounded-xl border border-border w-full max-w-[560px] shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-8 bg-accent/10 rounded-lg flex items-center justify-center">
              <Wand2 size={15} className="text-accent" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">AI Task Optimizer</h2>
              <p className="text-[11px] text-muted-foreground">Analyzes your tasks for quick wins</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary rounded-md text-muted-foreground">
            <X size={15} />
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center py-10 gap-3">
              <div className="size-12 bg-accent/10 rounded-full flex items-center justify-center">
                <Wand2 size={18} className="text-accent animate-pulse" />
              </div>
              <p className="text-sm font-medium">Analyzing your tasks…</p>
              <p className="text-xs text-muted-foreground">Checking priorities, deadlines, and workload</p>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-2">
              <Check size={32} className="text-emerald-500" />
              <p className="text-sm font-medium">Your task setup looks great!</p>
              <p className="text-xs text-muted-foreground">No optimizations needed right now.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.map(s => (
                <div
                  key={s.id}
                  className={`border rounded-lg p-4 transition-colors ${
                    s.status === "accepted" ? "border-emerald-200 bg-emerald-50/30" :
                    s.status === "rejected" ? "border-border opacity-40" : "border-border"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${tagColors[s.tag] ?? "bg-secondary text-muted-foreground border-border"}`}>
                          {s.tag}
                        </span>
                        {s.status === "accepted" && <span className="text-[10px] text-emerald-600 flex items-center gap-0.5"><Check size={9} /> Applied</span>}
                        {s.status === "rejected" && <span className="text-[10px] text-muted-foreground">Dismissed</span>}
                      </div>
                      <p className="text-sm font-medium">{s.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.description}</p>
                    </div>
                  </div>
                  {s.status === "pending" && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                      <button
                        onClick={() => accept(s)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-accent text-white rounded text-xs font-medium hover:opacity-90"
                      >
                        <Check size={10} /> Apply
                      </button>
                      <button
                        onClick={() => reject(s.id)}
                        className="flex items-center gap-1 px-3 py-1.5 border border-border text-muted-foreground rounded text-xs hover:bg-secondary"
                      >
                        <X size={10} /> Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── TasksView ────────────────────────────────────────────────────────────────

function TasksView({
  tasks, setTasks, workspaces,
  timerElapsed, timerRunning, timerWorkspaceId,
  onAddTask, onOpenSettings,
  onStart, onPause, onRequestEnd,
  onShowOptimize, onCreateStepWorkspace, onNavigateToWorkspace,
}: {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  workspaces: Workspace[];
  timerElapsed: number;
  timerRunning: boolean;
  timerWorkspaceId: string | null;
  onAddTask: () => void;
  onOpenSettings: (taskId: string) => void;
  onStart: (workspaceId: string) => void;
  onPause: () => void;
  onRequestEnd: (workspaceId: string) => void;
  onShowOptimize: () => void;
  onCreateStepWorkspace: (taskId: string, stepId: string) => void;
  onNavigateToWorkspace: (wsId: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pFilter, setPFilter] = useState<Priority | "all">("all");
  const [sFilter, setSFilter] = useState<TaskStatus | "all">("all");

  const filtered = tasks
    .filter(t => pFilter === "all" || t.priority === pFilter)
    .filter(t => sFilter === "all" || t.status === sFilter)
    .sort((a, b) => {
      if (a.starred !== b.starred) return a.starred ? -1 : 1;
      const o: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      if (o[a.priority] !== o[b.priority]) return o[a.priority] - o[b.priority];
      return a.deadline.localeCompare(b.deadline);
    });

  function toggleStep(tid: string, sid: string) {
    setTasks(ts => ts.map(t => t.id !== tid ? t : {
      ...t,
      steps: t.steps.map(s => s.id === sid ? { ...s, done: !s.done } : s),
    }));
  }

  function toggleStar(id: string) {
    setTasks(ts => ts.map(t => t.id === id ? { ...t, starred: !t.starred } : t));
  }

  const statusLabels: Record<TaskStatus | "all", string> = {
    all: "All", todo: "To Do", "in-progress": "In Progress", done: "Done",
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <div className="px-8 py-5 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Tasks</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your work as a checklist — the same tasks appear on the Calendar.
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tasks.filter(t => t.status !== "done").length} active · {tasks.filter(t => t.starred).length} starred
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onShowOptimize}
              className="flex items-center gap-2 px-3.5 py-2 border border-border text-sm font-medium rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
            >
              <Wand2 size={14} className="text-accent" /> AI Optimize
            </button>
            <button
              onClick={onAddTask}
              className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus size={14} /> Add Task
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-1">
            {(["all", "critical", "high", "medium", "low"] as const).map(p => {
              const cfg = p !== "all" ? PRIORITY_CFG[p] : null;
              return (
                <button
                  key={p}
                  onClick={() => setPFilter(p)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    pFilter === p
                      ? cfg ? `${cfg.bg} ${cfg.color}` : "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p === "all" ? "All" : cfg?.label}
                </button>
              );
            })}
          </div>
          <div className="w-px h-3.5 bg-border" />
          <div className="flex items-center gap-1">
            {(["all", "todo", "in-progress", "done"] as const).map(s => (
              <button
                key={s}
                onClick={() => setSFilter(s)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  sFilter === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {statusLabels[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-2">
        {filtered.map(task => {
          const cfg = PRIORITY_CFG[task.priority];
          const dl = daysLeft(task.deadline);
          const isExpanded = expandedId === task.id;
          const done = task.steps.filter(s => s.done).length;
          const pct = task.steps.length > 0 ? done / task.steps.length : 0;
          const ws = task.workspaceId ? workspaces.find(w => w.id === task.workspaceId) : undefined;
          const isThisTimerRunning = timerRunning && timerWorkspaceId === task.workspaceId;
          const isOtherTimerRunning = timerRunning && timerWorkspaceId !== task.workspaceId;

          return (
            <div key={task.id} className="bg-card border border-border rounded-lg overflow-hidden">
              <div
                className="px-5 py-3.5 cursor-pointer hover:bg-secondary/40 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : task.id)}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={e => { e.stopPropagation(); toggleStar(task.id); }}
                    className={`shrink-0 transition-colors ${task.starred ? "text-amber-400" : "text-muted-foreground/30 hover:text-amber-400"}`}
                  >
                    <Star size={14} fill={task.starred ? "currentColor" : "none"} />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{task.title}</span>
                      {ws && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent rounded font-mono shrink-0">WS</span>
                      )}
                      {task.recurrence !== "none" && (
                        <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-secondary text-muted-foreground rounded shrink-0">
                          <Repeat size={8} /> {RECURRENCE_LABELS[task.recurrence]}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className={`flex items-center gap-1 text-xs ${cfg.color}`}>
                        <div className={`size-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                      <span className={`text-xs ${dl <= 2 ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                        Due {fmtDate(task.deadline)}{dl <= 3 && dl >= 0 ? ` · ${dl}d left` : dl < 0 ? " · overdue" : ""}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">{done}/{task.steps.length}</span>
                    </div>
                  </div>

                  <div className="w-16 shrink-0">
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct * 100}%` }} />
                    </div>
                    <div className="text-[10px] text-right text-muted-foreground mt-0.5 font-mono">{Math.round(pct * 100)}%</div>
                  </div>

                  {/* Timer controls */}
                  {task.workspaceId && (
                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      {isThisTimerRunning ? (
                        <>
                          <span className="font-mono text-xs text-emerald-600 tabular-nums min-w-[52px]">{fmtTime(timerElapsed)}</span>
                          <button
                            onClick={onPause}
                            title="Pause"
                            className="p-1.5 rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                          >
                            <Pause size={11} fill="currentColor" />
                          </button>
                          <button
                            onClick={() => onRequestEnd(task.workspaceId!)}
                            title="End session"
                            className="p-1.5 rounded-md bg-secondary text-foreground hover:bg-muted transition-colors"
                          >
                            <Square size={11} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => onStart(task.workspaceId!)}
                          title={isOtherTimerRunning ? "Switch session to this task" : "Start session"}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-foreground/5 text-foreground hover:bg-foreground/10 transition-colors text-xs font-medium"
                        >
                          <Play size={10} fill="currentColor" />
                          {isOtherTimerRunning ? "Switch" : "Start"}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Settings */}
                  <button
                    onClick={e => { e.stopPropagation(); onOpenSettings(task.id); }}
                    className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    title="Task settings"
                  >
                    <Settings size={13} />
                  </button>

                  <ChevronRight
                    size={14}
                    className={`text-muted-foreground shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                  />
                </div>
              </div>

              {isExpanded && (
                <div className="px-5 pb-4 border-t border-border pt-3">
                  {task.description && (
                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{task.description}</p>
                  )}
                  <div className="space-y-1.5">
                    {task.steps.map(step => (
                      <div key={step.id} className="flex items-center gap-2.5 group">
                        <div
                          className={`shrink-0 size-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                            step.done ? "bg-accent border-accent" : "border-border group-hover:border-foreground/40"
                          }`}
                          onClick={() => toggleStep(task.id, step.id)}
                        >
                          {step.done && <Check size={9} className="text-white" />}
                        </div>
                        <span
                          className={`text-sm leading-5 flex-1 cursor-pointer ${step.done ? "text-muted-foreground line-through" : "text-foreground"}`}
                          onClick={() => toggleStep(task.id, step.id)}
                        >
                          {step.title}
                        </span>
                        {step.workspaceId ? (
                          <button
                            onClick={() => onNavigateToWorkspace(step.workspaceId!)}
                            title="Open step workspace"
                            className="shrink-0 text-[9px] px-1.5 py-0.5 bg-accent/10 text-accent rounded border border-accent/20 hover:bg-accent/20 transition-colors"
                          >
                            WS
                          </button>
                        ) : (
                          <button
                            onClick={() => onCreateStepWorkspace(task.id, step.id)}
                            title="Create workspace for this step"
                            className="shrink-0 text-[9px] px-1.5 py-0.5 bg-secondary text-muted-foreground rounded border border-border hover:border-accent hover:text-accent opacity-0 group-hover:opacity-100 transition-all"
                          >
                            + WS
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── CalendarView ─────────────────────────────────────────────────────────────

function CalendarView({ tasks, gcalEvents, gcalConnected, setGcalConnected }: {
  tasks: Task[];
  gcalEvents: GCalEvent[];
  gcalConnected: boolean;
  setGcalConnected: (v: boolean) => void;
}) {
  const [cur, setCur] = useState(new Date("2026-06-01"));
  const [selectedDay, setSelectedDay] = useState<number | null>(5);
  const [syncing, setSyncing] = useState(false);

  const year = cur.getFullYear();
  const month = cur.getMonth();
  const monthName = cur.toLocaleString("default", { month: "long" });
  const totalDays = daysInMonth(year, month);
  const startDay = firstDayOfMonth(year, month);
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function dateStr(d: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const tasksOnDay = (d: number) => tasks.filter(t => t.deadline === dateStr(d));
  const eventsOnDay = (d: number) => gcalConnected ? gcalEvents.filter(e => e.date === dateStr(d)) : [];
  const hasConflict = (d: number) => tasksOnDay(d).length > 0 && eventsOnDay(d).length > 0;

  function connectGcal() {
    setSyncing(true);
    setTimeout(() => { setSyncing(false); setGcalConnected(true); }, 1800);
  }

  const selTasks = selectedDay ? tasksOnDay(selectedDay) : [];
  const selEvents = selectedDay ? eventsOnDay(selectedDay) : [];

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <div className="px-8 py-5 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">Calendar</h1>
            <div className="flex items-center gap-1">
              <button onClick={() => setCur(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="p-1.5 hover:bg-secondary rounded transition-colors">
                <ChevronLeft size={15} />
              </button>
              <span className="text-sm font-medium min-w-[130px] text-center">{monthName} {year}</span>
              <button onClick={() => setCur(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="p-1.5 hover:bg-secondary rounded transition-colors">
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              {(["critical","high","medium","low"] as Priority[]).map(p => (
                <span key={p} className="flex items-center gap-1">
                  <div className={`size-2 rounded-full ${PRIORITY_CFG[p].dot}`} />
                  {PRIORITY_CFG[p].label}
                </span>
              ))}
              {gcalConnected && <span className="flex items-center gap-1"><div className="size-2 rounded-full bg-blue-400" />Google Cal</span>}
            </div>
            <button
              onClick={gcalConnected ? undefined : connectGcal}
              disabled={syncing}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                gcalConnected ? "bg-blue-50 text-blue-700 border border-blue-200" : "border border-border hover:bg-secondary"
              }`}
            >
              {syncing ? <RefreshCcw size={11} className="animate-spin" /> : <CalendarDays size={11} />}
              {syncing ? "Syncing…" : gcalConnected ? "Google Calendar synced" : "Connect Google Calendar"}
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          The same tasks on a timeline — connect Google Calendar so deadlines and meetings line up.
        </p>
      </div>

      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 p-6 flex flex-col overflow-hidden">
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-border border border-border rounded-lg overflow-hidden flex-1">
            {Array.from({ length: startDay }).map((_, i) => (
              <div key={`e${i}`} className="bg-secondary/20" />
            ))}
            {Array.from({ length: totalDays }).map((_, i) => {
              const day = i + 1;
              const dt = tasksOnDay(day);
              const de = eventsOnDay(day);
              const isToday = year === 2026 && month === 5 && day === 5;
              const isSelected = selectedDay === day;
              const conflict = hasConflict(day);
              return (
                <div
                  key={day}
                  onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                  className={`bg-card p-1.5 cursor-pointer hover:bg-secondary/50 transition-colors min-h-[72px] ${isSelected ? "ring-1 ring-inset ring-accent" : ""}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full ${isToday ? "bg-accent text-white" : "text-foreground"}`}>{day}</span>
                    {conflict && <AlertTriangle size={9} className="text-amber-500" />}
                  </div>
                  <div className="space-y-0.5">
                    {dt.slice(0, 2).map(t => (
                      <div key={t.id} className={`text-[9px] px-1 py-0.5 rounded truncate font-medium ${PRIORITY_CFG[t.priority].bg} ${PRIORITY_CFG[t.priority].color}`}>
                        {t.title}
                      </div>
                    ))}
                    {de.slice(0, 1).map(e => (
                      <div key={e.id} className="text-[9px] px-1 py-0.5 rounded truncate bg-blue-50 text-blue-700">{e.title}</div>
                    ))}
                    {dt.length + de.length > 3 && (
                      <div className="text-[9px] text-muted-foreground pl-1">+{dt.length + de.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {selectedDay !== null && (
          <div className="w-[260px] border-l border-border p-5 overflow-y-auto shrink-0">
            <h3 className="text-sm font-semibold mb-3">
              {new Date(`${year}-${String(month+1).padStart(2,"0")}-${String(selectedDay).padStart(2,"0")}T00:00:00`)
                .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </h3>
            {selTasks.length === 0 && selEvents.length === 0 && (
              <p className="text-xs text-muted-foreground">Nothing scheduled on this date.</p>
            )}
            {selTasks.length > 0 && (
              <div className="mb-4">
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-2 font-mono">Task Deadlines</div>
                <div className="space-y-2">
                  {selTasks.map(t => (
                    <div key={t.id} className={`px-3 py-2 rounded-md ${PRIORITY_CFG[t.priority].bg} border ${PRIORITY_CFG[t.priority].border}`}>
                      <div className={`text-xs font-medium ${PRIORITY_CFG[t.priority].color}`}>{t.title}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{t.steps.filter(s => s.done).length}/{t.steps.length} steps complete</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selEvents.length > 0 && (
              <div className="mb-4">
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-2 font-mono">Google Calendar</div>
                <div className="space-y-2">
                  {selEvents.map(e => (
                    <div key={e.id} className="px-3 py-2 rounded-md bg-blue-50 border border-blue-200">
                      <div className="text-xs font-medium text-blue-800">{e.title}</div>
                      <div className="text-[10px] text-blue-600 mt-0.5 font-mono">{e.time}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {hasConflict(selectedDay) && (
              <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-md">
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 mb-1">
                  <AlertTriangle size={11} /> Scheduling Conflict
                </div>
                <p className="text-[11px] text-amber-600 leading-relaxed">A task deadline overlaps with a calendar event. Consider rescheduling.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PlanView ─────────────────────────────────────────────────────────────────

function PlanView({ tasks }: { tasks: Task[] }) {
  const [goalText, setGoalText] = useState("Launch my own design tool SaaS within 12 months");
  const [generating, setGenerating] = useState(false);
  const [planReady, setPlanReady] = useState(false);
  const [plan, setPlan] = useState<PlanStep[]>([]);
  const [refiningId, setRefiningId] = useState<string | null>(null);

  function generate() {
    setGenerating(true); setPlanReady(false);
    setTimeout(() => {
      setGenerating(false); setPlanReady(true);
      setPlan(PLAN_TEMPLATE.map(p => ({ ...p, status: "pending", refined: false })));
    }, 2400);
  }

  function accept(id: string) { setPlan(ps => ps.map(p => p.id === id ? { ...p, status: "accepted" } : p)); }
  function remove(id: string) { setPlan(ps => ps.map(p => p.id === id ? { ...p, status: "removed" } : p)); }
  function acceptAll() { setPlan(ps => ps.map(p => p.status === "pending" ? { ...p, status: "accepted" } : p)); }

  function refine(id: string) {
    setRefiningId(id);
    setTimeout(() => {
      setPlan(ps => ps.map(p => p.id !== id ? p : {
        ...p,
        description: p.description + " Also: track weekly output metrics (commits, tasks closed, hours logged) to measure momentum objectively.",
        refined: true,
      }));
      setRefiningId(null);
    }, 1600);
  }

  const visible = plan.filter(p => p.status !== "removed");
  const allDone = planReady && visible.length > 0 && visible.every(p => p.status !== "pending");

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <div className="px-8 py-5 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-9 bg-accent/10 rounded-lg flex items-center justify-center">
            <Brain size={17} className="text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">AI Planning</h1>
            <p className="text-xs text-muted-foreground">Long-term goal advisor — reads your tasks, sessions, and calendar</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 max-w-[760px] w-full mx-auto">
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { icon: <ListTodo size={14} />, label: `${tasks.length} tasks`, sub: `${tasks.filter(t => ["critical","high"].includes(t.priority)).length} high/critical` },
            { icon: <Brain size={14} />, label: "2 session notes", sub: "from last 7 days" },
            { icon: <CalendarDays size={14} />, label: "6 calendar events", sub: "this month" },
          ].map((c, i) => (
            <div key={i} className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-3">
              <span className="text-muted-foreground shrink-0">{c.icon}</span>
              <div>
                <div className="text-sm font-medium">{c.label}</div>
                <div className="text-[11px] text-muted-foreground">{c.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mb-6">
          <label className="text-sm font-medium block mb-2">What is your long-term goal?</label>
          <div className="flex gap-2">
            <input
              value={goalText}
              onChange={e => setGoalText(e.target.value)}
              placeholder="e.g. Become an engineering manager in 18 months"
              className="flex-1 px-4 py-2.5 border border-border rounded-md text-sm bg-card outline-none focus:ring-2 focus:ring-accent/30"
            />
            <button
              onClick={generate}
              disabled={generating || !goalText.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {generating ? <RefreshCcw size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {generating ? "Generating…" : "Generate Plan"}
            </button>
          </div>
        </div>

        {generating && (
          <div className="bg-card border border-border rounded-lg py-10 flex flex-col items-center gap-3">
            <div className="size-11 bg-accent/10 rounded-full flex items-center justify-center">
              <Brain size={18} className="text-accent animate-pulse" />
            </div>
            <p className="text-sm font-medium">Reading your context…</p>
            <p className="text-xs text-muted-foreground">Analyzing tasks, session notes, and calendar events</p>
          </div>
        )}

        {!planReady && !generating && (
          <div className="bg-gradient-to-br from-accent/5 to-accent/10 border border-accent/15 rounded-xl py-10 flex flex-col items-center gap-3 text-center px-8">
            <div className="size-12 bg-accent/10 rounded-full flex items-center justify-center">
              <Sparkles size={20} className="text-accent" />
            </div>
            <h3 className="text-base font-semibold">AI-powered long-term planning</h3>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              Enter your goal and the AI advisor generates a personalized, step-by-step plan — reading your existing tasks, session notes, and calendar to make it contextually relevant.
            </p>
          </div>
        )}

        {planReady && !generating && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold">Generated Plan</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[360px]">Goal: {goalText}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={acceptAll} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md text-xs font-medium hover:bg-emerald-100">
                  <Check size={11} /> Accept All
                </button>
                <button onClick={generate} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-md text-xs text-muted-foreground hover:text-foreground">
                  <RefreshCcw size={11} /> Regenerate
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {visible.map((step, idx) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`bg-card border rounded-lg p-4 transition-colors ${
                    step.status === "accepted" ? "border-emerald-200 bg-emerald-50/20" : step.refined ? "border-accent/25" : "border-border"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 size-6 rounded-full flex items-center justify-center text-xs font-medium mt-0.5 ${
                      step.status === "accepted" ? "bg-emerald-100 text-emerald-700" : "bg-secondary text-muted-foreground font-mono"
                    }`}>
                      {step.status === "accepted" ? <Check size={11} /> : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-sm font-medium leading-snug">{step.title}</h3>
                        <span className="text-[10px] font-mono text-muted-foreground shrink-0 mt-0.5 whitespace-nowrap">{step.timeline}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{step.description}</p>
                      {step.context && (
                        <div className="mt-2 flex items-start gap-1.5 text-xs text-accent">
                          <Sparkles size={10} className="mt-0.5 shrink-0" />
                          <span className="leading-relaxed">{step.context}</span>
                        </div>
                      )}
                      {step.refined && (
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-600">
                          <Check size={9} /> Refined by AI
                        </div>
                      )}
                    </div>
                  </div>
                  {step.status === "pending" && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                      <button onClick={() => accept(step.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-xs font-medium hover:bg-emerald-100">
                        <Check size={10} /> Accept
                      </button>
                      <button onClick={() => refine(step.id)} disabled={refiningId === step.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 text-accent rounded text-xs font-medium hover:bg-accent/15 disabled:opacity-50">
                        {refiningId === step.id ? <RefreshCcw size={10} className="animate-spin" /> : <Sparkles size={10} />}
                        {refiningId === step.id ? "Refining…" : "Refine with AI"}
                      </button>
                      <button onClick={() => remove(step.id)} className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-muted-foreground rounded text-xs hover:text-red-500 hover:border-red-200">
                        <X size={10} /> Remove
                      </button>
                    </div>
                  )}
                  {step.status === "accepted" && (
                    <div className="flex items-center gap-1.5 mt-2 pt-2.5 border-t border-emerald-200 text-[11px] text-emerald-600">
                      <Check size={10} /> Accepted — added to your plan
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            {allDone && (
              <div className="mt-6 py-6 bg-accent/5 border border-accent/15 rounded-xl text-center">
                <div className="text-sm font-semibold text-accent mb-1">Plan finalized</div>
                <p className="text-xs text-muted-foreground">
                  {visible.filter(p => p.status === "accepted").length} steps accepted.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AddTaskModal ─────────────────────────────────────────────────────────────

function AddTaskModal({ isOpen, onClose, onAdd }: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: { task: Omit<Task, "id" | "workspaceId">; createWorkspace: boolean; workspaceName: string; stepWsItems: { id: string; title: string }[] }) => void;
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [deadline, setDeadline] = useState("2026-07-01");
  const [starred, setStarred] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceType>("none");
  const [steps, setSteps] = useState<string[]>(["", ""]);
  const [stepWsFlags, setStepWsFlags] = useState<boolean[]>([false, false]);
  const [createWorkspace, setCreateWorkspace] = useState(true);
  const [workspaceName, setWorkspaceName] = useState("");

  function submit() {
    if (!title.trim()) return;
    const stepObjs = steps
      .map((s, i) => ({ id: uid(), title: s.trim(), done: false, wsEnabled: stepWsFlags[i] ?? false }))
      .filter(s => s.title);
    onAdd({
      task: {
        title: title.trim(), description: desc, priority,
        status: "todo", deadline, starred, recurrence,
        steps: stepObjs.map(({ wsEnabled: _, ...s }) => s),
      },
      createWorkspace,
      workspaceName: workspaceName.trim() || title.trim(),
      stepWsItems: stepObjs.filter(s => s.wsEnabled).map(s => ({ id: s.id, title: s.title })),
    });
    onClose();
    setTitle(""); setDesc(""); setPriority("medium"); setDeadline("2026-07-01");
    setStarred(false); setRecurrence("none"); setSteps(["", ""]); setStepWsFlags([false, false]);
    setCreateWorkspace(true); setWorkspaceName("");
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="bg-card rounded-xl border border-border w-full max-w-[540px] shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-sm font-semibold">New Task</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary rounded-md text-muted-foreground">
            <X size={15} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium block mb-1.5">Title <span className="text-red-500">*</span></label>
            <input
              autoFocus value={title}
              onChange={e => { setTitle(e.target.value); if (!workspaceName) setWorkspaceName(e.target.value); }}
              placeholder="What needs to be done?"
              className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          <div>
            <label className="text-xs font-medium block mb-1.5">Description</label>
            <textarea
              value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Add more context or acceptance criteria…"
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background resize-none outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1.5">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value as Priority)}
                className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background outline-none focus:ring-2 focus:ring-accent/30">
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5">Deadline</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium block mb-1.5">Recurrence</label>
            <select value={recurrence} onChange={e => setRecurrence(e.target.value as RecurrenceType)}
              className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background outline-none focus:ring-2 focus:ring-accent/30">
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium">Steps</label>
              <button onClick={() => { setSteps(s => [...s, ""]); setStepWsFlags(f => [...f, false]); }} className="flex items-center gap-1 text-xs text-accent hover:opacity-80">
                <Plus size={11} /> Add step
              </button>
            </div>
            <div className="space-y-2">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="size-4 rounded border border-border shrink-0" />
                  <input
                    value={step}
                    onChange={e => setSteps(ss => ss.map((v, j) => j === i ? e.target.value : v))}
                    placeholder={`Step ${i + 1}`}
                    className="flex-1 px-2.5 py-1.5 border border-border rounded text-sm bg-background outline-none focus:ring-1 focus:ring-accent/30"
                  />
                  <button
                    type="button"
                    onClick={() => setStepWsFlags(f => { const n = [...f]; n[i] = !n[i]; return n; })}
                    title={stepWsFlags[i] ? "Remove workspace for this step" : "Create workspace for this step"}
                    className={`shrink-0 text-[10px] px-1.5 py-1 rounded border transition-colors ${
                      stepWsFlags[i]
                        ? "border-accent/40 text-accent bg-accent/8"
                        : "border-border text-muted-foreground hover:border-accent hover:text-accent"
                    }`}
                  >
                    WS
                  </button>
                  {steps.length > 1 && (
                    <button
                      onClick={() => {
                        setSteps(ss => ss.filter((_, j) => j !== i));
                        setStepWsFlags(f => f.filter((_, j) => j !== i));
                      }}
                      className="text-muted-foreground hover:text-red-500"
                    >
                      <Minus size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Workspace init */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCreateWorkspace(v => !v)}
                  className={`size-4 rounded border flex items-center justify-center transition-colors ${createWorkspace ? "bg-accent border-accent" : "border-border"}`}
                >
                  {createWorkspace && <Check size={9} className="text-white" />}
                </button>
                <span className="text-sm font-medium">Initialize workspace</span>
              </div>
              <LayoutDashboard size={14} className="text-muted-foreground" />
            </div>
            {createWorkspace && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Workspace name</label>
                <input
                  value={workspaceName}
                  onChange={e => setWorkspaceName(e.target.value)}
                  placeholder={title || "Workspace name"}
                  className="w-full px-2.5 py-1.5 border border-border rounded-md text-sm bg-background outline-none focus:ring-1 focus:ring-accent/30"
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  A workspace lets you log sessions, track resources, and manage notes for this task.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-3.5 py-3 bg-secondary rounded-md">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setStarred(s => !s)}
                className={`transition-colors ${starred ? "text-amber-400" : "text-muted-foreground hover:text-amber-400"}`}
              >
                <Star size={15} fill={starred ? "currentColor" : "none"} />
              </button>
              <div>
                <div className="text-xs font-medium">Mark as starred</div>
                <div className="text-[11px] text-muted-foreground">Starred tasks appear at the top</div>
              </div>
            </div>
            <div className="flex items-center gap-3 border-l border-border pl-3 ml-2">
              <div className="flex items-center gap-1.5">
                <Sparkles size={13} className="text-muted-foreground" />
                <div>
                  <div className="text-xs font-medium">AI Audit</div>
                  <div className="text-[10px] text-muted-foreground">Review for clarity</div>
                </div>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-700 font-medium">
                <Lock size={9} /> Premium
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex gap-2">
          <button
            onClick={submit}
            disabled={!title.trim()}
            className="flex-1 py-2 bg-foreground text-background rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-40"
          >
            Create Task
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-md text-sm hover:bg-secondary">
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

// ─── OnboardingOverlay ────────────────────────────────────────────────────────

const ONBOARDING_SLIDES = [
  {
    icon: <LayoutDashboard size={28} className="text-accent" />,
    title: "One focus workspace, not four tools.",
    body: "FocusFlow replaces the scattered jumble of to-do apps, timers, and calendars. Everything you need to do — and the time you spend on it — lives in a single workspace.",
  },
  {
    icon: <Play size={28} className="text-accent" fill="currentColor" />,
    title: "Plan, start, and resume in seconds.",
    body: "Open a workspace, hit Start, and you're working. Step away and pick up exactly where you left off with one click — your sessions, notes, and resources are always right there.",
  },
  {
    icon: <CalendarDays size={28} className="text-accent" />,
    title: "Your to-do list and calendar, one set of tasks.",
    body: "See your work as a checklist or on a timeline — it's the same tasks, never duplicated. Connect Google Calendar so deadlines and meetings line up automatically.",
  },
];

function OnboardingOverlay({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const last = i === ONBOARDING_SLIDES.length - 1;
  const slide = ONBOARDING_SLIDES[i];
  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center px-6" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
      <button onClick={onDone} className="absolute top-5 right-6 text-xs text-muted-foreground hover:text-foreground transition-colors">
        Skip
      </button>

      <div className="flex items-center gap-2.5 mb-10">
        <div className="size-7 rounded bg-accent flex items-center justify-center">
          <Zap size={13} className="text-white" />
        </div>
        <span className="font-semibold text-[15px] tracking-tight">FocusFlow</span>
      </div>

      <div className="w-full max-w-[440px] min-h-[220px] flex flex-col items-center text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="flex flex-col items-center"
          >
            <div className="size-14 rounded-xl bg-accent/10 flex items-center justify-center mb-6">
              {slide.icon}
            </div>
            <h2 className="text-2xl font-semibold tracking-tight mb-3 leading-snug">{slide.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{slide.body}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-2 mt-10 mb-8">
        {ONBOARDING_SLIDES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setI(idx)}
            className={`h-1.5 rounded-full transition-all ${idx === i ? "w-6 bg-accent" : "w-1.5 bg-border hover:bg-muted-foreground"}`}
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        {i > 0 && (
          <button
            onClick={() => setI(i - 1)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={14} /> Back
          </button>
        )}
        <button
          onClick={() => (last ? onDone() : setI(i + 1))}
          className="flex items-center gap-1.5 px-5 py-2 rounded-md text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
        >
          {last ? "Get started" : "Next"}
          {last ? <ArrowUpRight size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [activeView, setActiveView] = useState<AppView>("workspace");
  const [tasks, setTasks] = useState<Task[]>(INIT_TASKS);
  const [workspaces, setWorkspaces] = useState<Workspace[]>(INIT_WORKSPACES);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(INIT_WORKSPACES[0].id);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [settingsTaskId, setSettingsTaskId] = useState<string | null>(null);
  const [showOptimize, setShowOptimize] = useState(false);
  const [endingWorkspaceId, setEndingWorkspaceId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(
    () => typeof localStorage !== "undefined" && !localStorage.getItem("ff_onboarded")
  );

  function dismissOnboarding() {
    try { localStorage.setItem("ff_onboarded", "1"); } catch { /* ignore */ }
    setActiveView("workspace");
    setShowOnboarding(false);
  }

  const [timerWorkspaceId, setTimerWorkspaceId] = useState<string | null>(null);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setTimerElapsed(t => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  function startTimer(workspaceId: string) {
    if (timerWorkspaceId !== workspaceId) {
      if (timerElapsed > 0 && timerWorkspaceId) {
        const date = new Date().toISOString().slice(0, 10);
        setWorkspaces(ws => ws.map(w => w.id === timerWorkspaceId ? {
          ...w, sessions: [...w.sessions, { id: uid(), date, duration: timerElapsed, comment: "Auto-saved on workspace switch" }]
        } : w));
      }
      setTimerElapsed(0);
      setTimerWorkspaceId(workspaceId);
    }
    setTimerRunning(true);
  }

  function pauseTimer() {
    setTimerRunning(false);
  }

  function endSession(workspaceId: string, comment: string) {
    setTimerRunning(false);
    if (timerElapsed > 0) {
      const date = new Date().toISOString().slice(0, 10);
      setWorkspaces(ws => ws.map(w => w.id === workspaceId ? {
        ...w, sessions: [...w.sessions, { id: uid(), date, duration: timerElapsed, comment }]
      } : w));
    }
    setTimerElapsed(0);
    setTimerWorkspaceId(null);
    setEndingWorkspaceId(null);
  }

  function updateTask(taskId: string, updates: Partial<Task>) {
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, ...updates } : t));

    if (updates.status === "done") {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      if (timerRunning && timerWorkspaceId === task.workspaceId) {
        endSession(task.workspaceId!, "Task marked as done.");
        toast.success("Session ended", { description: "Task marked as done." });
      }
      if (task.recurrence !== "none") {
        const nextDeadline = advanceDeadline(task.deadline, task.recurrence);
        setTimeout(() => {
          setTasks(ts => ts.map(t => t.id === taskId ? {
            ...t, status: "todo", deadline: nextDeadline,
            steps: t.steps.map(s => ({ ...s, done: false })),
          } : t));
          toast.success(`Task reset for ${task.recurrence} recurrence`, { description: `Next deadline: ${fmtDate(nextDeadline)}` });
        }, 400);
      }
    }
  }

  function deleteTask(taskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const wsIdsToRemove = new Set<string>();
    if (task.workspaceId) wsIdsToRemove.add(task.workspaceId);
    task.steps.forEach(s => { if (s.workspaceId) wsIdsToRemove.add(s.workspaceId); });
    if (timerWorkspaceId && wsIdsToRemove.has(timerWorkspaceId)) {
      setTimerRunning(false); setTimerElapsed(0); setTimerWorkspaceId(null);
    }
    setWorkspaces(ws => ws.filter(w => !wsIdsToRemove.has(w.id)));
    setTasks(ts => ts.filter(t => t.id !== taskId));
    setSettingsTaskId(null);
  }

  function createStepWorkspace(taskId: string, stepId: string) {
    const task = tasks.find(t => t.id === taskId);
    const step = task?.steps.find(s => s.id === stepId);
    if (!step || step.workspaceId) return;
    const newWsId = uid();
    setWorkspaces(ws => [...ws, { id: newWsId, name: step.title, taskId, stepId, resources: [], sessions: [] }]);
    setTasks(ts => ts.map(t => t.id === taskId ? {
      ...t, steps: t.steps.map(s => s.id === stepId ? { ...s, workspaceId: newWsId } : s)
    } : t));
  }

  function removeStepWorkspace(taskId: string, stepId: string, wsId: string) {
    setWorkspaces(ws => ws.filter(w => w.id !== wsId));
    setTasks(ts => ts.map(t => t.id === taskId ? {
      ...t, steps: t.steps.map(s => s.id === stepId ? { ...s, workspaceId: undefined } : s)
    } : t));
  }

  function createTaskWorkspace(taskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.workspaceId) return;
    const newWsId = uid();
    setWorkspaces(ws => [...ws, { id: newWsId, name: task.title, taskId, resources: [], sessions: [] }]);
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, workspaceId: newWsId } : t));
  }

  function addTask(data: { task: Omit<Task, "id" | "workspaceId">; createWorkspace: boolean; workspaceName: string; stepWsItems: { id: string; title: string }[] }) {
    const taskId = uid();
    let workspaceId: string | undefined;
    const newWorkspaces: Workspace[] = [];

    if (data.createWorkspace) {
      workspaceId = uid();
      newWorkspaces.push({ id: workspaceId, name: data.workspaceName, taskId, resources: [], sessions: [] });
    }

    // Build a map of stepId -> wsId for steps that want workspaces
    const stepWsMap = new Map<string, string>();
    data.stepWsItems.forEach(({ id, title }) => {
      const wsId = uid();
      stepWsMap.set(id, wsId);
      newWorkspaces.push({ id: wsId, name: title, taskId, stepId: id, resources: [], sessions: [] });
    });

    const steps = data.task.steps.map(s => ({
      ...s,
      workspaceId: stepWsMap.get(s.id),
    }));

    if (newWorkspaces.length > 0) {
      setWorkspaces(ws => [...ws, ...newWorkspaces]);
    }
    setTasks(ts => [...ts, { id: taskId, ...data.task, steps, workspaceId }]);
  }

  function applyOptimization(taskId: string, field: string, value: unknown) {
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, [field]: value } : t));
  }

  function navigateToWorkspace(wsId: string) {
    setActiveWorkspaceId(wsId);
    setActiveView("workspace");
    setSettingsTaskId(null);
  }

  const settingsTask = settingsTaskId ? tasks.find(t => t.id === settingsTaskId) : null;
  const settingsWorkspace = settingsTask?.workspaceId ? workspaces.find(w => w.id === settingsTask.workspaceId) : undefined;

  const timerTask = timerWorkspaceId ? tasks.find(t => t.workspaceId === timerWorkspaceId) : null;
  const timerTaskName = timerTask?.title ?? workspaces.find(w => w.id === timerWorkspaceId)?.name ?? "";

  return (
    <div className="flex h-screen overflow-hidden bg-background" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
      <Toaster position="bottom-right" />

      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        timerRunning={timerRunning}
        timerDisplay={fmtTime(timerElapsed)}
        timerTaskName={timerTaskName}
        gcalConnected={gcalConnected}
      />

      <main className="flex-1 overflow-hidden flex">
        {activeView === "workspace" && (
          <WorkspaceView
            workspaces={workspaces}
            setWorkspaces={setWorkspaces}
            tasks={tasks}
            activeWorkspaceId={activeWorkspaceId}
            setActiveWorkspaceId={setActiveWorkspaceId}
            timerElapsed={timerElapsed}
            timerRunning={timerRunning}
            timerWorkspaceId={timerWorkspaceId}
            onStart={startTimer}
            onPause={pauseTimer}
            onRequestEnd={wsId => setEndingWorkspaceId(wsId)}
          />
        )}
        {activeView === "tasks" && (
          <TasksView
            tasks={tasks}
            setTasks={setTasks}
            workspaces={workspaces}
            timerElapsed={timerElapsed}
            timerRunning={timerRunning}
            timerWorkspaceId={timerWorkspaceId}
            onAddTask={() => setAddTaskOpen(true)}
            onOpenSettings={id => setSettingsTaskId(id)}
            onStart={startTimer}
            onPause={pauseTimer}
            onRequestEnd={wsId => setEndingWorkspaceId(wsId)}
            onShowOptimize={() => setShowOptimize(true)}
            onCreateStepWorkspace={(taskId, stepId) => createStepWorkspace(taskId, stepId)}
            onNavigateToWorkspace={navigateToWorkspace}
          />
        )}
        {activeView === "calendar" && (
          <CalendarView tasks={tasks} gcalEvents={GCAL_EVENTS} gcalConnected={gcalConnected} setGcalConnected={setGcalConnected} />
        )}
        {activeView === "plan" && <PlanView tasks={tasks} />}
      </main>

      <AddTaskModal
        isOpen={addTaskOpen}
        onClose={() => setAddTaskOpen(false)}
        onAdd={addTask}
      />

      {/* Task settings panel */}
      <AnimatePresence>
        {settingsTask && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/25 z-40"
              onClick={() => setSettingsTaskId(null)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-[440px] bg-card border-l border-border z-50 shadow-2xl"
            >
              <TaskSettingsPanel
                task={settingsTask}
                workspace={settingsWorkspace}
                workspaces={workspaces}
                onUpdateTask={updates => updateTask(settingsTask.id, updates)}
                onUpdateWorkspace={(wsId, updates) => setWorkspaces(ws => ws.map(w => w.id === wsId ? { ...w, ...updates } : w))}
                onCreateWorkspace={() => createTaskWorkspace(settingsTask.id)}
                onCreateStepWorkspace={stepId => createStepWorkspace(settingsTask.id, stepId)}
                onRemoveStepWorkspace={(stepId, wsId) => removeStepWorkspace(settingsTask.id, stepId, wsId)}
                onDeleteTask={() => deleteTask(settingsTask.id)}
                onOpenWorkspace={navigateToWorkspace}
                onClose={() => setSettingsTaskId(null)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* AI Optimize modal */}
      {showOptimize && (
        <AIOptimizeModal
          tasks={tasks}
          onApply={applyOptimization}
          onClose={() => setShowOptimize(false)}
        />
      )}

      {/* End session modal */}
      {endingWorkspaceId && (
        <EndSessionModal
          elapsed={timerElapsed}
          onSave={comment => endSession(endingWorkspaceId, comment)}
          onCancel={() => setEndingWorkspaceId(null)}
        />
      )}

      {/* First-run intro */}
      {showOnboarding && <OnboardingOverlay onDone={dismissOnboarding} />}
    </div>
  );
}
