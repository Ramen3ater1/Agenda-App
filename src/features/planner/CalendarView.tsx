import { Plus } from "lucide-react";
import { PRIORITY_CFG } from "@/constants";
import { toISO, taskStartISO, daysInWindow, type TimeWindow } from "@/lib/timeWindow";
import TimeGridSurface from "./TimeGridSurface";
import type { Task, GCalEvent } from "@/types";

interface ViewProps {
  tasks: Task[];
  window: TimeWindow;
  gcalEvents: GCalEvent[];
  gcalConnected: boolean;
  onSelectTask: (id: string) => void;
  onCreateAt: (date: string, startTime?: string, durationMin?: number) => void;
  onReschedule: (id: string, startDate: string, startTime: string) => void;
  onResize: (id: string, durationMin: number) => void;
}

// ── Month grid ───────────────────────────────────────────────────────────────

function MonthGrid({ tasks, window, gcalEvents, gcalConnected, onSelectTask, onCreateAt }: ViewProps) {
  const year = window.start.getFullYear();
  const month = window.start.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const startDay = new Date(year, month, 1).getDay();
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayISOv = toISO(new Date());

  const dateStr = (d: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const tasksOn = (d: number) => tasks.filter(t => taskStartISO(t) === dateStr(d));
  const eventsOn = (d: number) => gcalConnected ? gcalEvents.filter(e => e.date === dateStr(d)) : [];

  return (
    <div className="flex-1 flex flex-col overflow-hidden px-8 py-5">
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border border border-border rounded-lg overflow-hidden flex-1">
        {Array.from({ length: startDay }).map((_, i) => <div key={`e${i}`} className="bg-secondary/20" />)}
        {Array.from({ length: totalDays }).map((_, i) => {
          const day = i + 1;
          const dt = tasksOn(day);
          const de = eventsOn(day);
          const isToday = dateStr(day) === todayISOv;
          return (
            <div key={day} className="bg-card p-1.5 min-h-[80px] relative group">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full ${isToday ? "bg-accent text-white" : "text-foreground"}`}>{day}</span>
              </div>
              <div className="space-y-0.5">
                {dt.slice(0, 3).map(t => (
                  <div key={t.id} onClick={() => onSelectTask(t.id)}
                    className={`text-[9px] px-1 py-0.5 rounded truncate font-medium cursor-pointer hover:brightness-95 ${PRIORITY_CFG[t.priority].bg} ${PRIORITY_CFG[t.priority].color} ${t.status === "done" ? "line-through opacity-60" : ""}`}>
                    {t.startTime ? `${t.startTime} ` : ""}{t.title}
                  </div>
                ))}
                {de.slice(0, 1).map(e => (
                  <div key={e.id} className="text-[9px] px-1 py-0.5 rounded truncate bg-blue-50 text-blue-700">{e.title}</div>
                ))}
                {dt.length + de.length > 4 && <div className="text-[9px] text-muted-foreground pl-1">+{dt.length + de.length - 4} more</div>}
              </div>
              <button onClick={() => onCreateAt(dateStr(day))} title="Add task"
                className="absolute top-0.5 right-0.5 size-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-accent transition-all">
                <Plus size={10} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Day / Week ──────────────────────────────────────────────────────────────

export default function CalendarView(props: ViewProps) {
  if (props.window.level === "month") return <MonthGrid {...props} />;

  // day → single column; week → 7 columns
  return (
    <TimeGridSurface
      days={daysInWindow(props.window)}
      tasks={props.tasks}
      variant="compact"
      gcalEvents={props.gcalEvents}
      gcalConnected={props.gcalConnected}
      onSelectTask={props.onSelectTask}
      onReschedule={props.onReschedule}
      onResize={props.onResize}
      onCreateAt={(date, start, dur) => props.onCreateAt(date, start, dur)}
    />
  );
}
