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
  Folder, FolderOpen, Sun, Layers, ArrowLeft,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = "critical" | "high" | "medium" | "low";
type TaskStatus = "todo" | "in-progress" | "done";
type SmartList = "today" | "all" | "calendar";
type ResourceType = "link" | "file" | "note";
type RecurrenceType = "none" | "daily" | "weekly" | "monthly";

interface TaskStep {
  id: string;
  title: string;
  done: boolean;
}

interface Folder {
  id: string;
  name: string;
}

interface Task {
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

const INIT_FOLDERS: Folder[] = [
  { id: "f1", name: "Design" },
  { id: "f2", name: "Work" },
  { id: "f3", name: "Learning" },
];

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
    priority: "high", status: "in-progress", deadline: "2026-06-20", folderId: "f1",
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
    priority: "critical", status: "todo", deadline: "2026-06-08", folderId: "f2",
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
    priority: "medium", status: "in-progress", deadline: "2026-07-15", folderId: "f3",
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
    priority: "low", status: "todo", deadline: "2026-06-25", folderId: "f2",
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
    priority: "high", status: "todo", deadline: "2026-06-12",
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
    context: "Your high-priority tasks and Figma/Next.js stack suggest you are building toward a design-engineering positioning.",
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

function Sidebar({
  activeList, onSelectList, folders, tasks,
  onCreateFolder, onRenameFolder, onDeleteFolder,
  timerRunning, timerDisplay, timerTaskName,
}: {
  activeList: string;
  onSelectList: (id: string) => void;
  folders: Folder[];
  tasks: Task[];
  onCreateFolder: (name: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  timerRunning: boolean;
  timerDisplay: string;
  timerTaskName: string;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const isToday = (t: Task) => t.status !== "done" && (daysLeft(t.deadline) <= 1 || t.status === "in-progress");
  const todayCount = tasks.filter(isToday).length;
  const activeCount = tasks.filter(t => t.status !== "done").length;

  function submitNew() {
    if (!newName.trim()) return;
    onCreateFolder(newName.trim());
    setNewName(""); setAdding(false);
  }
  function submitRename(id: string) {
    if (editName.trim()) onRenameFolder(id, editName.trim());
    setEditingId(null);
  }

  const smartItem = (id: SmartList, icon: React.ReactNode, label: string, count?: number) => {
    const isActive = activeList === id;
    return (
      <button
        onClick={() => onSelectList(id)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
          isActive ? "bg-accent text-white" : "text-[#9E9E9C] hover:bg-sidebar-accent hover:text-sidebar-foreground"
        }`}
      >
        {icon}
        <span className="flex-1 text-left">{label}</span>
        {count != null && count > 0 && (
          <span className={`text-[11px] font-mono ${isActive ? "text-white/70" : "text-[#6B6B68]"}`}>{count}</span>
        )}
      </button>
    );
  };

  const groupHeading = "px-3 pt-4 pb-1.5 text-[10px] uppercase tracking-[0.12em] text-[#6B6B68] font-semibold select-none";

  return (
    <aside className="w-[240px] shrink-0 bg-sidebar flex flex-col h-screen sticky top-0">
      <div className="px-5 pt-6 pb-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded bg-accent flex items-center justify-center">
            <Zap size={13} className="text-white" />
          </div>
          <span className="text-sidebar-foreground font-semibold text-[15px] tracking-tight">Agenda</span>
        </div>
        <p className="text-[11px] text-[#6B6B68] mt-2 leading-snug">Plan, track, and finish your work.</p>
      </div>

      <nav className="flex-1 px-2.5 py-2 overflow-y-auto">
        {smartItem("today", <Sun size={16} />, "Today", todayCount)}
        {smartItem("all", <Layers size={16} />, "All", activeCount)}
        {smartItem("calendar", <CalendarDays size={16} />, "Calendar")}

        <div className="flex items-center justify-between pr-1">
          <div className={groupHeading}>Lists</div>
          <button
            onClick={() => setAdding(v => !v)}
            title="New list"
            className="size-5 flex items-center justify-center rounded text-[#6B6B68] hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <Plus size={13} />
          </button>
        </div>

        {adding && (
          <div className="px-2 py-1">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submitNew(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }}
              onBlur={() => { if (!newName.trim()) setAdding(false); }}
              placeholder="List name…"
              className="w-full px-2 py-1 bg-sidebar-accent border border-sidebar-border rounded text-xs text-sidebar-foreground outline-none placeholder:text-[#555553]"
            />
          </div>
        )}

        {folders.map(f => {
          const isActive = activeList === f.id;
          const count = tasks.filter(t => t.folderId === f.id && t.status !== "done").length;
          if (editingId === f.id) {
            return (
              <div key={f.id} className="px-2 py-1">
                <input
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") submitRename(f.id); if (e.key === "Escape") setEditingId(null); }}
                  onBlur={() => submitRename(f.id)}
                  className="w-full px-2 py-1 bg-sidebar-accent border border-sidebar-border rounded text-xs text-sidebar-foreground outline-none"
                />
              </div>
            );
          }
          return (
            <div
              key={f.id}
              onClick={() => onSelectList(f.id)}
              onDoubleClick={() => { setEditingId(f.id); setEditName(f.name); }}
              className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm cursor-pointer transition-colors ${
                isActive ? "bg-accent text-white" : "text-[#9E9E9C] hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <Folder size={15} className={isActive ? "text-white" : "text-amber-400/80"} />
              <span className="flex-1 text-left truncate">{f.name}</span>
              {count > 0 && (
                <span className={`text-[11px] font-mono group-hover:hidden ${isActive ? "text-white/70" : "text-[#6B6B68]"}`}>{count}</span>
              )}
              <button
                onClick={e => { e.stopPropagation(); onDeleteFolder(f.id); }}
                title="Delete list"
                className="hidden group-hover:flex shrink-0 text-[#6B6B68] hover:text-red-400"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
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

// ─── TaskListView ───────────────────────────────────────────────────────────

function TaskListView({
  title, subtitle, tasks, folders, showFolderTag,
  selectedTaskId, onSelectTask, onToggleDone, onAddTask,
  onShowOptimize, onShowAIPlan,
}: {
  title: string;
  subtitle: string;
  tasks: Task[];
  folders: Folder[];
  showFolderTag: boolean;
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onToggleDone: (id: string) => void;
  onAddTask: (title: string) => void;
  onShowOptimize: () => void;
  onShowAIPlan: () => void;
}) {
  const [draft, setDraft] = useState("");
  function submit() { if (draft.trim()) { onAddTask(draft.trim()); setDraft(""); } }
  const active = tasks.filter(t => t.status !== "done").length;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <div className="px-8 py-5 border-b border-border shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle} &middot; {active} active</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onShowAIPlan} className="flex items-center gap-2 px-3.5 py-2 border border-border text-sm font-medium rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
              <Brain size={14} className="text-accent" /> AI Plan
            </button>
            <button onClick={onShowOptimize} className="flex items-center gap-2 px-3.5 py-2 border border-border text-sm font-medium rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
              <Wand2 size={14} className="text-accent" /> AI Optimize
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-5">
        <div className="flex items-center gap-2.5 px-4 py-3 mb-3 bg-card border border-border rounded-lg">
          <Plus size={16} className="text-muted-foreground shrink-0" />
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="Add a task — press Enter"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {draft.trim() && <button onClick={submit} className="text-xs px-2.5 py-1 bg-foreground text-background rounded font-medium">Add</button>}
        </div>

        <div className="space-y-1.5">
          {tasks.map(task => {
            const cfg = PRIORITY_CFG[task.priority];
            const dl = daysLeft(task.deadline);
            const done = task.status === "done";
            const doneSteps = task.steps.filter(s => s.done).length;
            const pct = task.steps.length ? doneSteps / task.steps.length : 0;
            const folder = task.folderId ? folders.find(f => f.id === task.folderId) : undefined;
            const isSel = selectedTaskId === task.id;
            return (
              <div
                key={task.id}
                onClick={() => onSelectTask(task.id)}
                className={`group flex items-center gap-3 px-4 py-3 bg-card border rounded-lg cursor-pointer transition-colors ${isSel ? "border-accent" : "border-border hover:bg-secondary/40"} ${done ? "opacity-60" : ""}`}
              >
                <div
                  onClick={e => { e.stopPropagation(); onToggleDone(task.id); }}
                  className={`shrink-0 size-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${done ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/30 hover:border-accent"}`}
                >
                  {done && <Check size={11} className="text-white" strokeWidth={3} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium truncate ${done ? "line-through text-muted-foreground" : ""}`}>{task.title}</span>
                    {task.recurrence !== "none" && (
                      <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-secondary text-muted-foreground rounded shrink-0">
                        <Repeat size={8} /> {RECURRENCE_LABELS[task.recurrence]}
                      </span>
                    )}
                    {showFolderTag && folder && (
                      <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent rounded shrink-0">
                        <Folder size={8} /> {folder.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className={`flex items-center gap-1 text-xs ${cfg.color}`}>
                      <div className={`size-1.5 rounded-full ${cfg.dot}`} /> {cfg.label}
                    </span>
                    <span className={`text-xs ${dl <= 2 ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                      Due {fmtDate(task.deadline)}{dl <= 3 && dl >= 0 ? ` · ${dl}d left` : dl < 0 ? " · overdue" : ""}
                    </span>
                    {task.steps.length > 0 && <span className="text-xs text-muted-foreground font-mono">{doneSteps}/{task.steps.length}</span>}
                  </div>
                </div>
                {task.steps.length > 0 && (
                  <div className="w-14 shrink-0">
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct * 100}%` }} />
                    </div>
                  </div>
                )}
                <ChevronRight size={16} className="text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
              </div>
            );
          })}
          {tasks.length === 0 && (
            <div className="text-center py-16 text-sm text-muted-foreground">
              Nothing here yet. Add a task above to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TaskDetailPanel ─────────────────────────────────────────────────────────

function TaskDetailPanel({
  task, workspace, folders,
  onBack, onPrev, onNext, position,
  onUpdateTask, onToggleDone, onDeleteTask,
  timerElapsed, timerRunning, timerWorkspaceId,
  onStartFocus, onPause, onRequestEnd, onUpdateWorkspace,
}: {
  task: Task;
  workspace?: Workspace;
  folders: Folder[];
  onBack: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  position: string;
  onUpdateTask: (updates: Partial<Task>) => void;
  onToggleDone: () => void;
  onDeleteTask: () => void;
  timerElapsed: number;
  timerRunning: boolean;
  timerWorkspaceId: string | null;
  onStartFocus: () => void;
  onPause: () => void;
  onRequestEnd: (workspaceId: string) => void;
  onUpdateWorkspace: (wsId: string, updates: Partial<Workspace>) => void;
}) {
  const [newStep, setNewStep] = useState("");
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [stepTitle, setStepTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addingRes, setAddingRes] = useState(false);
  const [newRes, setNewRes] = useState({ type: "link" as ResourceType, title: "", value: "" });

  const done = task.status === "done";
  const isRunning = timerRunning && workspace != null && timerWorkspaceId === workspace.id;
  const effectiveElapsed = isRunning ? timerElapsed : 0;
  const totalTime = (workspace?.sessions.reduce((a, s) => a + s.duration, 0) ?? 0) + effectiveElapsed;

  function addStep() { if (newStep.trim()) { onUpdateTask({ steps: [...task.steps, { id: uid(), title: newStep.trim(), done: false }] }); setNewStep(""); } }
  function saveStep(id: string) { if (stepTitle.trim()) onUpdateTask({ steps: task.steps.map(s => s.id === id ? { ...s, title: stepTitle.trim() } : s) }); setEditingStepId(null); }
  function toggleStep(id: string) { onUpdateTask({ steps: task.steps.map(s => s.id === id ? { ...s, done: !s.done } : s) }); }
  function removeStep(id: string) { onUpdateTask({ steps: task.steps.filter(s => s.id !== id) }); }

  function addResource() {
    if (!workspace || !newRes.title.trim()) return;
    onUpdateWorkspace(workspace.id, { resources: [...workspace.resources, { id: uid(), ...newRes }] });
    setNewRes({ type: "link", title: "", value: "" }); setAddingRes(false);
  }
  function removeResource(rid: string) {
    if (!workspace) return;
    onUpdateWorkspace(workspace.id, { resources: workspace.resources.filter(r => r.id !== rid) });
  }
  const resIcon = (t: ResourceType) => t === "link" ? <Link2 size={13} /> : t === "file" ? <FileText size={13} /> : <StickyNote size={13} />;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <div className="px-6 py-3 border-b border-border flex items-center justify-between shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={15} /> Back to list
        </button>
        <div className="flex items-center gap-1.5">
          {position && <span className="text-[11px] text-muted-foreground font-mono mr-1">{position}</span>}
          <button onClick={onPrev} disabled={!onPrev} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent transition-colors"><ChevronLeft size={16} /></button>
          <button onClick={onNext} disabled={!onNext} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent transition-colors"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[880px] mx-auto px-8 py-6 grid grid-cols-[1fr_300px] gap-6">
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <div onClick={onToggleDone} className={`mt-1 shrink-0 size-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${done ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/30 hover:border-accent"}`}>
                {done && <Check size={13} className="text-white" strokeWidth={3} />}
              </div>
              <textarea
                value={task.title}
                onChange={e => onUpdateTask({ title: e.target.value })}
                rows={1}
                className={`flex-1 text-xl font-semibold bg-transparent outline-none resize-none focus:bg-secondary/40 rounded px-1.5 -mx-1.5 py-0.5 ${done ? "line-through text-muted-foreground" : ""}`}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Notes</label>
              <textarea
                value={task.description}
                onChange={e => onUpdateTask({ description: e.target.value })}
                rows={3}
                placeholder="Add notes, context, or acceptance criteria…"
                className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background resize-none outline-none focus:ring-1 focus:ring-accent/30"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-2">Steps</label>
              <div className="space-y-1.5">
                {task.steps.map(step => (
                  <div key={step.id} className="flex items-center gap-2.5 group">
                    <div onClick={() => toggleStep(step.id)} className={`shrink-0 size-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${step.done ? "bg-accent border-accent" : "border-border hover:border-foreground/40"}`}>
                      {step.done && <Check size={9} className="text-white" />}
                    </div>
                    {editingStepId === step.id ? (
                      <input autoFocus value={stepTitle} onChange={e => setStepTitle(e.target.value)} onBlur={() => saveStep(step.id)} onKeyDown={e => e.key === "Enter" && saveStep(step.id)} className="flex-1 text-sm px-1.5 py-0.5 border border-border rounded outline-none focus:ring-1 focus:ring-accent/30 bg-background" />
                    ) : (
                      <span onClick={() => { setEditingStepId(step.id); setStepTitle(step.title); }} className={`flex-1 text-sm cursor-text ${step.done ? "line-through text-muted-foreground" : ""}`}>{step.title}</span>
                    )}
                    <button onClick={() => removeStep(step.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all p-0.5"><Trash2 size={11} /></button>
                  </div>
                ))}
                <div className="flex items-center gap-2.5">
                  <div className="size-4 shrink-0 rounded border border-dashed border-border" />
                  <input value={newStep} onChange={e => setNewStep(e.target.value)} onKeyDown={e => e.key === "Enter" && addStep()} placeholder="Add a step…" className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/60" />
                  {newStep.trim() && <button onClick={addStep} className="text-xs text-accent hover:opacity-80">Add</button>}
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg border border-border p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Focus session</div>
                {isRunning && <span className="flex items-center gap-1 text-[11px] text-emerald-600"><div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Recording</span>}
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="font-mono text-3xl font-medium tracking-tight leading-none">{fmtTime(effectiveElapsed)}</div>
                  <div className="text-xs text-muted-foreground mt-2 font-mono">Total logged: {fmtTime(totalTime)}</div>
                </div>
                <div className="flex items-center gap-2">
                  {!isRunning ? (
                    <button onClick={onStartFocus} className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-md text-sm font-medium hover:opacity-90 transition-opacity"><Play size={13} fill="currentColor" /> Start</button>
                  ) : (
                    <>
                      <button onClick={onPause} className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 rounded-md text-sm font-medium hover:bg-amber-200 transition-colors"><Pause size={13} fill="currentColor" /> Pause</button>
                      <button onClick={() => workspace && onRequestEnd(workspace.id)} className="flex items-center gap-2 px-4 py-2 bg-secondary text-foreground rounded-md text-sm font-medium hover:bg-muted transition-colors"><Square size={13} /> End</button>
                    </>
                  )}
                </div>
              </div>
              {workspace && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium">Resources</span>
                    <button onClick={() => setAddingRes(v => !v)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"><Plus size={12} /> Add</button>
                  </div>
                  {addingRes && (
                    <div className="flex gap-2 mb-2">
                      <select value={newRes.type} onChange={e => setNewRes(r => ({ ...r, type: e.target.value as ResourceType }))} className="text-xs border border-border rounded px-2 py-1.5 bg-card">
                        <option value="link">Link</option><option value="file">File</option><option value="note">Note</option>
                      </select>
                      <input autoFocus value={newRes.title} onChange={e => setNewRes(r => ({ ...r, title: e.target.value }))} onKeyDown={e => e.key === "Enter" && addResource()} placeholder="Title or URL" className="flex-1 text-xs border border-border rounded px-2.5 py-1.5 bg-card outline-none focus:ring-1 focus:ring-accent/40" />
                      <button onClick={addResource} className="text-xs px-3 py-1.5 bg-foreground text-background rounded font-medium">Add</button>
                    </div>
                  )}
                  <div className="space-y-1">
                    {workspace.resources.map(r => (
                      <div key={r.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-secondary rounded group">
                        <span className="text-muted-foreground shrink-0">{resIcon(r.type)}</span>
                        <span className="text-xs flex-1 truncate">{r.title}</span>
                        <button onClick={() => removeResource(r.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all"><X size={10} /></button>
                      </div>
                    ))}
                    {workspace.resources.length === 0 && <p className="text-[11px] text-muted-foreground py-1">No resources yet.</p>}
                  </div>
                </div>
              )}
            </div>

            <div>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600 flex-1">Delete this task permanently?</span>
                  <button onClick={onDeleteTask} className="text-xs px-2.5 py-1.5 bg-red-500 text-white rounded font-medium">Delete</button>
                  <button onClick={() => setConfirmDelete(false)} className="text-xs px-2.5 py-1.5 border border-border rounded">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={12} /> Delete task</button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-card rounded-lg border border-border p-4 space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">List</label>
                <select value={task.folderId ?? ""} onChange={e => onUpdateTask({ folderId: e.target.value || undefined })} className="w-full px-2.5 py-1.5 border border-border rounded-md text-sm bg-background outline-none focus:ring-1 focus:ring-accent/30">
                  <option value="">No list</option>
                  {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Priority</label>
                <select value={task.priority} onChange={e => onUpdateTask({ priority: e.target.value as Priority })} className="w-full px-2.5 py-1.5 border border-border rounded-md text-sm bg-background outline-none focus:ring-1 focus:ring-accent/30">
                  <option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Status</label>
                <select value={task.status} onChange={e => onUpdateTask({ status: e.target.value as TaskStatus })} className="w-full px-2.5 py-1.5 border border-border rounded-md text-sm bg-background outline-none focus:ring-1 focus:ring-accent/30">
                  <option value="todo">To Do</option><option value="in-progress">In Progress</option><option value="done">Done</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Due date</label>
                <input type="date" value={task.deadline} onChange={e => onUpdateTask({ deadline: e.target.value })} className="w-full px-2.5 py-1.5 border border-border rounded-md text-sm bg-background outline-none focus:ring-1 focus:ring-accent/30" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Repeat</label>
                <select value={task.recurrence} onChange={e => onUpdateTask({ recurrence: e.target.value as RecurrenceType })} className="w-full px-2.5 py-1.5 border border-border rounded-md text-sm bg-background outline-none focus:ring-1 focus:ring-accent/30">
                  <option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            {workspace && workspace.sessions.length > 0 && (
              <div className="bg-card rounded-lg border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="text-sm font-medium">Session history</h3>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{workspace.sessions.length} sessions &middot; {fmtTime(workspace.sessions.reduce((a, s) => a + s.duration, 0))} total</div>
                </div>
                <div className="p-3 space-y-2 max-h-[280px] overflow-y-auto">
                  {[...workspace.sessions].reverse().map(s => (
                    <div key={s.id} className="border border-border rounded-md p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-muted-foreground">{fmtSessionDate(s.date)}</span>
                        <span className="font-mono text-xs font-medium">{fmtTime(s.duration)}</span>
                      </div>
                      {s.comment && <p className="text-[11px] text-foreground leading-relaxed">{s.comment}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
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


// ─── CalendarView ─────────────────────────────────────────────────────────────

function CalendarView({ tasks, gcalEvents, gcalConnected, setGcalConnected, onSelectTask, onAddTaskForDate }: {
  tasks: Task[];
  gcalEvents: GCalEvent[];
  gcalConnected: boolean;
  setGcalConnected: (v: boolean) => void;
  onSelectTask: (taskId: string) => void;
  onAddTaskForDate: (date: string) => void;
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
    <div className="flex-1 flex flex-col overflow-hidden px-8 py-6">
      <div className="pt-2 pb-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => setCur(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="p-1.5 hover:bg-secondary rounded transition-colors">
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-medium min-w-[130px] text-center">{monthName} {year}</span>
            <button onClick={() => setCur(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="p-1.5 hover:bg-secondary rounded transition-colors">
              <ChevronRight size={15} />
            </button>
          </div>
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

      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 flex flex-col overflow-hidden">
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
                  className={`bg-card p-1.5 cursor-pointer hover:bg-secondary/50 transition-colors min-h-[72px] relative group ${
                    isSelected ? "ring-1 ring-inset ring-accent" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full ${isToday ? "bg-accent text-white" : "text-foreground"}`}>{day}</span>
                    {conflict && <AlertTriangle size={9} className="text-amber-500" />}
                  </div>
                  <div className="space-y-0.5">
                    {dt.slice(0, 2).map(t => (
                      <div
                        key={t.id}
                        onClick={e => { e.stopPropagation(); onSelectTask(t.id); }}
                        className={`text-[9px] px-1 py-0.5 rounded truncate font-medium cursor-pointer hover:brightness-95 ${PRIORITY_CFG[t.priority].bg} ${PRIORITY_CFG[t.priority].color} ${t.status === "done" ? "line-through opacity-60" : ""}`}
                      >
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
                  <button
                    onClick={e => { e.stopPropagation(); onAddTaskForDate(dateStr(day)); }}
                    title="Add task for this date"
                    className="absolute top-0.5 right-0.5 size-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-accent transition-all"
                  >
                    <Plus size={10} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {selectedDay !== null && (
          <div className="w-[260px] border-l border-border p-5 overflow-y-auto shrink-0 ml-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">
                {new Date(`${year}-${String(month+1).padStart(2,"0")}-${String(selectedDay).padStart(2,"0")}T00:00:00`)
                  .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </h3>
              <button
                onClick={() => onAddTaskForDate(dateStr(selectedDay))}
                title="Add task for this date"
                className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus size={13} />
              </button>
            </div>
            {selTasks.length === 0 && selEvents.length === 0 && (
              <p className="text-xs text-muted-foreground">Nothing scheduled on this date.</p>
            )}
            {selTasks.length > 0 && (
              <div className="mb-4">
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-2 font-mono">Task Deadlines</div>
                <div className="space-y-2">
                  {selTasks.map(t => (
                    <div
                      key={t.id}
                      onClick={() => onSelectTask(t.id)}
                      className={`px-3 py-2 rounded-md cursor-pointer hover:brightness-95 transition-all ${PRIORITY_CFG[t.priority].bg} border ${PRIORITY_CFG[t.priority].border}`}
                    >
                      <div className={`text-xs font-medium ${PRIORITY_CFG[t.priority].color} ${t.status === "done" ? "line-through" : ""}`}>
                        {t.title}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {t.steps.filter(s => s.done).length}/{t.steps.length} steps complete
                        {t.status === "done" && <span className="text-emerald-500 ml-1">Done</span>}
                      </div>
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


// ─── AIPlanPanel ──────────────────────────────────────────────────────────────

function AIPlanPanel({ tasks, onClose }: { tasks: Task[]; onClose: () => void }) {
  const [goalText, setGoalText] = useState("Launch my own design tool SaaS within 12 months");
  const [generating, setGenerating] = useState(false);
  const [planReady, setPlanReady] = useState(false);
  const [plan, setPlan] = useState<PlanStep[]>([]);
  const [refiningId, setRefiningId] = useState<string | null>(null);

  function generate() {
    setGenerating(true); setPlanReady(false);
    setTimeout(() => {
      setGenerating(false); setPlanReady(true);
      setPlan(PLAN_TEMPLATE.map(p => ({ ...p, status: "pending" as const, refined: false })));
    }, 2400);
  }

  function accept(id: string) { setPlan(ps => ps.map(p => p.id === id ? { ...p, status: "accepted" as const } : p)); }
  function remove(id: string) { setPlan(ps => ps.map(p => p.id === id ? { ...p, status: "removed" as const } : p)); }
  function acceptAll() { setPlan(ps => ps.map(p => p.status === "pending" ? { ...p, status: "accepted" as const } : p)); }

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
    <div className="h-full flex flex-col bg-background">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-9 bg-accent/10 rounded-lg flex items-center justify-center">
            <Brain size={17} className="text-accent" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">AI Planning</h2>
            <p className="text-xs text-muted-foreground">Long-term goal advisor</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-secondary rounded-md text-muted-foreground">
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { icon: <ListTodo size={12} />, label: `${tasks.length} tasks`, sub: `${tasks.filter(t => ["critical","high"].includes(t.priority)).length} high/critical` },
            { icon: <Brain size={12} />, label: "2 session notes", sub: "from last 7 days" },
            { icon: <CalendarDays size={12} />, label: "6 calendar events", sub: "this month" },
          ].map((c, i) => (
            <div key={i} className="bg-card border border-border rounded-lg px-3 py-2.5 flex items-center gap-2.5">
              <span className="text-muted-foreground shrink-0">{c.icon}</span>
              <div>
                <div className="text-[11px] font-medium">{c.label}</div>
                <div className="text-[10px] text-muted-foreground">{c.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mb-5">
          <label className="text-xs font-medium block mb-1.5">What is your long-term goal?</label>
          <div className="flex gap-2">
            <input
              value={goalText}
              onChange={e => setGoalText(e.target.value)}
              placeholder="e.g. Become an engineering manager in 18 months"
              className="flex-1 px-3 py-2 border border-border rounded-md text-sm bg-card outline-none focus:ring-2 focus:ring-accent/30"
            />
            <button
              onClick={generate}
              disabled={generating || !goalText.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-md text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {generating ? <RefreshCcw size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {generating ? "Generating\u2026" : "Generate Plan"}
            </button>
          </div>
        </div>

        {generating && (
          <div className="bg-card border border-border rounded-lg py-8 flex flex-col items-center gap-3">
            <div className="size-10 bg-accent/10 rounded-full flex items-center justify-center">
              <Brain size={16} className="text-accent animate-pulse" />
            </div>
            <p className="text-sm font-medium">Reading your context\u2026</p>
            <p className="text-xs text-muted-foreground">Analyzing tasks, session notes, and calendar events</p>
          </div>
        )}

        {!planReady && !generating && (
          <div className="bg-gradient-to-br from-accent/5 to-accent/10 border border-accent/15 rounded-xl py-8 flex flex-col items-center gap-3 text-center px-6">
            <div className="size-11 bg-accent/10 rounded-full flex items-center justify-center">
              <Sparkles size={18} className="text-accent" />
            </div>
            <h3 className="text-sm font-semibold">AI-powered long-term planning</h3>
            <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
              Enter your goal and the AI advisor generates a personalized, step-by-step plan \u2014 reading your existing tasks, session notes, and calendar to make it contextually relevant.
            </p>
          </div>
        )}

        {planReady && !generating && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-semibold">Generated Plan</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[280px]">Goal: {goalText}</p>
              </div>
              <div className="flex gap-1.5">
                <button onClick={acceptAll} className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md text-[11px] font-medium hover:bg-emerald-100">
                  <Check size={10} /> Accept All
                </button>
                <button onClick={generate} className="flex items-center gap-1 px-2.5 py-1.5 border border-border rounded-md text-[11px] text-muted-foreground hover:text-foreground">
                  <RefreshCcw size={10} /> Regenerate
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {visible.map((step, idx) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`bg-card border rounded-lg p-3.5 transition-colors ${
                    step.status === "accepted" ? "border-emerald-200 bg-emerald-50/20" : step.refined ? "border-accent/25" : "border-border"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`shrink-0 size-5 rounded-full flex items-center justify-center text-[10px] font-medium mt-0.5 ${
                      step.status === "accepted" ? "bg-emerald-100 text-emerald-700" : "bg-secondary text-muted-foreground font-mono"
                    }`}>
                      {step.status === "accepted" ? <Check size={10} /> : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-medium leading-snug">{step.title}</h4>
                        <span className="text-[9px] font-mono text-muted-foreground shrink-0 mt-0.5 whitespace-nowrap">{step.timeline}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{step.description}</p>
                      {step.context && (
                        <div className="mt-1.5 flex items-start gap-1 text-[11px] text-accent">
                          <Sparkles size={9} className="mt-0.5 shrink-0" />
                          <span className="leading-relaxed">{step.context}</span>
                        </div>
                      )}
                      {step.refined && (
                        <div className="mt-1 flex items-center gap-1 text-[9px] text-emerald-600">
                          <Check size={8} /> Refined by AI
                        </div>
                      )}
                    </div>
                  </div>
                  {step.status === "pending" && (
                    <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-border">
                      <button onClick={() => accept(step.id)} className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-[11px] font-medium hover:bg-emerald-100">
                        <Check size={9} /> Accept
                      </button>
                      <button onClick={() => refine(step.id)} disabled={refiningId === step.id} className="flex items-center gap-1 px-2.5 py-1.5 bg-accent/10 text-accent rounded text-[11px] font-medium hover:bg-accent/15 disabled:opacity-50">
                        {refiningId === step.id ? <RefreshCcw size={9} className="animate-spin" /> : <Sparkles size={9} />}
                        {refiningId === step.id ? "Refining\u2026" : "Refine with AI"}
                      </button>
                      <button onClick={() => remove(step.id)} className="flex items-center gap-1 px-2.5 py-1.5 border border-border text-muted-foreground rounded text-[11px] hover:text-red-500 hover:border-red-200">
                        <X size={9} /> Remove
                      </button>
                    </div>
                  )}
                  {step.status === "accepted" && (
                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-emerald-200 text-[10px] text-emerald-600">
                      <Check size={9} /> Accepted \u2014 added to your plan
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            {allDone && (
              <div className="mt-5 py-5 bg-accent/5 border border-accent/15 rounded-xl text-center">
                <div className="text-xs font-semibold text-accent mb-1">Plan finalized</div>
                <p className="text-[11px] text-muted-foreground">
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


// ─── App ──────────────────────────────────────────────────────────────────────

// ─── OnboardingOverlay ────────────────────────────────────────────────────────

const ONBOARDING_SLIDES = [
  {
    icon: <Sun size={28} className="text-accent" />,
    title: "Start every day with Today.",
    body: "Agenda opens on Today — the tasks due now, overdue, or already in motion. Organize the rest into your own lists so nothing gets lost.",
  },
  {
    icon: <Layers size={28} className="text-accent" />,
    title: "One set of tasks, two views.",
    body: "See your work as a checklist or on the calendar — it's the same tasks, never duplicated. Connect Google Calendar so deadlines and meetings line up automatically.",
  },
  {
    icon: <Play size={28} className="text-accent" fill="currentColor" />,
    title: "Open a task to focus and finish.",
    body: "Click any task to open its full page: edit the details, check off steps, and start a focus session that tracks your time and notes — then step back to your list.",
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
        <span className="font-semibold text-[15px] tracking-tight">Agenda</span>
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
  const [tasks, setTasks] = useState<Task[]>(INIT_TASKS);
  const [folders, setFolders] = useState<Folder[]>(INIT_FOLDERS);
  const [workspaces, setWorkspaces] = useState<Workspace[]>(INIT_WORKSPACES);
  const [gcalConnected, setGcalConnected] = useState(false);

  const [activeList, setActiveList] = useState<string>("today");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [showOptimize, setShowOptimize] = useState(false);
  const [showAIPlan, setShowAIPlan] = useState(false);
  const [endingWorkspaceId, setEndingWorkspaceId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(
    () => typeof localStorage !== "undefined" && !localStorage.getItem("ff_onboarded")
  );

  function dismissOnboarding() {
    try { localStorage.setItem("ff_onboarded", "1"); } catch { /* ignore */ }
    setActiveList("today");
    setShowOnboarding(false);
  }

  // ── Timer ──
  const [timerWorkspaceId, setTimerWorkspaceId] = useState<string | null>(null);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setTimerElapsed(t => t + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  function startTimer(workspaceId: string) {
    if (timerWorkspaceId !== workspaceId) {
      if (timerElapsed > 0 && timerWorkspaceId) {
        const date = new Date().toISOString().slice(0, 10);
        setWorkspaces(ws => ws.map(w => w.id === timerWorkspaceId ? {
          ...w, sessions: [...w.sessions, { id: uid(), date, duration: timerElapsed, comment: "Auto-saved on switch" }]
        } : w));
      }
      setTimerElapsed(0);
      setTimerWorkspaceId(workspaceId);
    }
    setTimerRunning(true);
  }
  function pauseTimer() { setTimerRunning(false); }
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

  // ── Task CRUD ──
  function updateTask(taskId: string, updates: Partial<Task>) {
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, ...updates } : t));
    if (updates.status === "done") {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      if (timerRunning && timerWorkspaceId === task.workspaceId) {
        endSession(task.workspaceId!, "Task marked as done.");
      }
      if (task.recurrence !== "none") {
        const nextDeadline = advanceDeadline(task.deadline, task.recurrence);
        setTimeout(() => {
          setTasks(ts => ts.map(t => t.id === taskId ? {
            ...t, status: "todo", deadline: nextDeadline, steps: t.steps.map(s => ({ ...s, done: false })),
          } : t));
          toast.success(`Recurring task reset — next: ${fmtDate(nextDeadline)}`);
        }, 500);
      }
    }
  }

  function toggleTaskDone(taskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (task.status === "done") {
      setTasks(ts => ts.map(t => t.id === taskId ? { ...t, status: "todo" } : t));
    } else {
      setTasks(ts => ts.map(t => t.id === taskId ? {
        ...t, status: "done", steps: t.steps.map(s => ({ ...s, done: true })),
      } : t));
      if (timerRunning && timerWorkspaceId === task.workspaceId) {
        endSession(task.workspaceId!, "Task marked as done.");
      }
      if (task.recurrence !== "none") {
        const nextDeadline = advanceDeadline(task.deadline, task.recurrence);
        setTimeout(() => {
          setTasks(ts => ts.map(t => t.id === taskId ? {
            ...t, status: "todo", deadline: nextDeadline, steps: t.steps.map(s => ({ ...s, done: false })),
          } : t));
          toast.success(`Recurring task reset — next: ${fmtDate(nextDeadline)}`);
        }, 600);
      } else {
        toast.success("Task completed");
      }
    }
  }

  function deleteTask(taskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (task.workspaceId) {
      if (timerWorkspaceId === task.workspaceId) {
        setTimerRunning(false); setTimerElapsed(0); setTimerWorkspaceId(null);
      }
      setWorkspaces(ws => ws.filter(w => w.id !== task.workspaceId));
    }
    setTasks(ts => ts.filter(t => t.id !== taskId));
    setDetailOpen(false);
    setSelectedTaskId(null);
  }

  function addTask(title: string, opts?: { deadline?: string; folderId?: string }) {
    const t = title.trim();
    if (!t) return;
    const folderId = opts?.folderId ?? (["today", "all", "calendar"].includes(activeList) ? undefined : activeList);
    const deadline = opts?.deadline ?? "2026-06-05";
    setTasks(ts => [...ts, {
      id: uid(), title: t, description: "", priority: "medium", status: "todo",
      deadline, steps: [], folderId, recurrence: "none",
    }]);
  }

  function ensureWorkspace(task: Task): string {
    if (task.workspaceId) return task.workspaceId;
    const id = uid();
    setWorkspaces(ws => [...ws, { id, name: task.title, taskId: task.id, resources: [], sessions: [] }]);
    setTasks(ts => ts.map(t => t.id === task.id ? { ...t, workspaceId: id } : t));
    return id;
  }
  function startFocus(task: Task) { startTimer(ensureWorkspace(task)); }

  function updateWorkspace(wsId: string, updates: Partial<Workspace>) {
    setWorkspaces(ws => ws.map(w => w.id === wsId ? { ...w, ...updates } : w));
  }

  function applyOptimization(taskId: string, field: string, value: unknown) {
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, [field]: value } : t));
  }

  // ── Folders ──
  function createFolder(name: string) {
    const id = uid();
    setFolders(fs => [...fs, { id, name }]);
    setActiveList(id);
    setDetailOpen(false);
    setSelectedTaskId(null);
  }
  function renameFolder(id: string, name: string) {
    setFolders(fs => fs.map(f => f.id === id ? { ...f, name } : f));
  }
  function deleteFolder(id: string) {
    setFolders(fs => fs.filter(f => f.id !== id));
    setTasks(ts => ts.map(t => t.folderId === id ? { ...t, folderId: undefined } : t));
    setActiveList(prev => prev === id ? "all" : prev);
  }

  // ── Derived: list filtering ──
  const isTodayTask = (t: Task) => t.status !== "done" && (daysLeft(t.deadline) <= 1 || t.status === "in-progress");
  const priorityOrder: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  function sortTasks(arr: Task[]) {
    return [...arr].sort((a, b) => {
      if ((a.status === "done") !== (b.status === "done")) return a.status === "done" ? 1 : -1;
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) return priorityOrder[a.priority] - priorityOrder[b.priority];
      return a.deadline.localeCompare(b.deadline);
    });
  }
  const listTasks = sortTasks(
    activeList === "today" ? tasks.filter(isTodayTask)
    : activeList === "all" ? tasks
    : activeList === "calendar" ? []
    : tasks.filter(t => t.folderId === activeList)
  );
  const listIds = listTasks.map(t => t.id);

  const activeFolder = folders.find(f => f.id === activeList);
  const listTitle = activeList === "today" ? "Today"
    : activeList === "all" ? "All tasks"
    : activeList === "calendar" ? "Calendar"
    : (activeFolder?.name ?? "Tasks");
  const listSubtitle = activeList === "today" ? "Due today, overdue, or in progress"
    : activeList === "all" ? "Every task across your lists"
    : activeFolder ? "Tasks in this list" : "";

  const selectedTask = selectedTaskId ? tasks.find(t => t.id === selectedTaskId) ?? null : null;
  const selectedWorkspace = selectedTask?.workspaceId ? workspaces.find(w => w.id === selectedTask.workspaceId) : undefined;
  const selIdx = selectedTaskId ? listIds.indexOf(selectedTaskId) : -1;

  function selectTask(id: string) { setSelectedTaskId(id); setDetailOpen(true); }
  function selectList(id: string) { setActiveList(id); setDetailOpen(false); setSelectedTaskId(null); }

  const timerTask = timerWorkspaceId ? tasks.find(t => t.workspaceId === timerWorkspaceId) : null;
  const timerTaskName = timerTask?.title ?? "";

  return (
    <div className="flex h-screen overflow-hidden bg-background" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
      <Toaster position="bottom-right" />
      <Sidebar
        activeList={activeList}
        onSelectList={selectList}
        folders={folders}
        tasks={tasks}
        onCreateFolder={createFolder}
        onRenameFolder={renameFolder}
        onDeleteFolder={deleteFolder}
        timerRunning={timerRunning}
        timerDisplay={fmtTime(timerElapsed)}
        timerTaskName={timerTaskName}
      />

      <main className="flex-1 overflow-hidden flex relative">
        {detailOpen && selectedTask ? (
          <TaskDetailPanel
            task={selectedTask}
            workspace={selectedWorkspace}
            folders={folders}
            onBack={() => setDetailOpen(false)}
            onPrev={selIdx > 0 ? () => setSelectedTaskId(listIds[selIdx - 1]) : undefined}
            onNext={selIdx >= 0 && selIdx < listIds.length - 1 ? () => setSelectedTaskId(listIds[selIdx + 1]) : undefined}
            position={selIdx >= 0 ? `${selIdx + 1} / ${listIds.length}` : ""}
            onUpdateTask={updates => updateTask(selectedTask.id, updates)}
            onToggleDone={() => toggleTaskDone(selectedTask.id)}
            onDeleteTask={() => deleteTask(selectedTask.id)}
            timerElapsed={timerElapsed}
            timerRunning={timerRunning}
            timerWorkspaceId={timerWorkspaceId}
            onStartFocus={() => startFocus(selectedTask)}
            onPause={pauseTimer}
            onRequestEnd={wsId => setEndingWorkspaceId(wsId)}
            onUpdateWorkspace={updateWorkspace}
          />
        ) : activeList === "calendar" ? (
          <CalendarView
            tasks={tasks}
            gcalEvents={GCAL_EVENTS}
            gcalConnected={gcalConnected}
            setGcalConnected={setGcalConnected}
            onSelectTask={selectTask}
            onAddTaskForDate={(date) => addTask("New task", { deadline: date })}
          />
        ) : (
          <TaskListView
            title={listTitle}
            subtitle={listSubtitle}
            tasks={listTasks}
            folders={folders}
            showFolderTag={activeList === "all"}
            selectedTaskId={selectedTaskId}
            onSelectTask={selectTask}
            onToggleDone={toggleTaskDone}
            onAddTask={(title) => addTask(title)}
            onShowOptimize={() => setShowOptimize(true)}
            onShowAIPlan={() => setShowAIPlan(true)}
          />
        )}

        <AnimatePresence>
          {showAIPlan && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                className="absolute inset-0 bg-black/25 z-30" onClick={() => setShowAIPlan(false)} />
              <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="absolute right-0 top-0 h-full w-[480px] bg-card border-l border-border z-40 shadow-2xl">
                <AIPlanPanel tasks={tasks} onClose={() => setShowAIPlan(false)} />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>

      {showOptimize && (
        <AIOptimizeModal tasks={tasks} onApply={applyOptimization} onClose={() => setShowOptimize(false)} />
      )}
      {endingWorkspaceId && (
        <EndSessionModal elapsed={timerElapsed} onSave={comment => endSession(endingWorkspaceId, comment)} onCancel={() => setEndingWorkspaceId(null)} />
      )}
      {showOnboarding && <OnboardingOverlay onDone={dismissOnboarding} />}
    </div>
  );
}
