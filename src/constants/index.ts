import type { Priority, RecurrenceType, Folder, Workspace, Task, GCalEvent, PlanStep } from "@/types";

export const PRIORITY_CFG: Record<Priority, { label: string; color: string; dot: string; bg: string; border: string }> = {
  critical: { label: "Critical", color: "text-red-600",    dot: "bg-red-500",    bg: "bg-red-50",    border: "border-red-200" },
  high:     { label: "High",     color: "text-orange-600", dot: "bg-orange-500", bg: "bg-orange-50", border: "border-orange-200" },
  medium:   { label: "Medium",   color: "text-amber-600",  dot: "bg-amber-400",  bg: "bg-amber-50",  border: "border-amber-200" },
  low:      { label: "Low",      color: "text-emerald-600",dot: "bg-emerald-500",bg: "bg-emerald-50",border: "border-emerald-200" },
};

export const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  none:    "Does not repeat",
  daily:   "Daily",
  weekly:  "Weekly",
  monthly: "Monthly",
};

export const INIT_FOLDERS: Folder[] = [
  { id: "f1", name: "Design" },
  { id: "f2", name: "Work" },
  { id: "f3", name: "Learning" },
];

export const INIT_WORKSPACES: Workspace[] = [
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

export const INIT_TASKS: Task[] = [
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

export const GCAL_EVENTS: GCalEvent[] = [
  { id: "e1", title: "Team Standup",     date: "2026-06-08", time: "9:00 AM" },
  { id: "e2", title: "1:1 with Manager", date: "2026-06-10", time: "2:00 PM" },
  { id: "e3", title: "Sprint Planning",  date: "2026-06-15", time: "10:00 AM" },
  { id: "e4", title: "Design Review",    date: "2026-06-20", time: "3:00 PM" },
  { id: "e5", title: "All-Hands Meeting",date: "2026-06-12", time: "11:00 AM" },
  { id: "e6", title: "Product Demo",     date: "2026-06-25", time: "1:00 PM" },
];

export const PLAN_TEMPLATE: PlanStep[] = [
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
