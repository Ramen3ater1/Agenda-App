import { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, RefreshCcw, AlertTriangle, Plus } from "lucide-react";
import { PRIORITY_CFG } from "@/constants";
import { daysInMonth, firstDayOfMonth } from "@/lib/utils";
import type { Task, GCalEvent, Priority } from "@/types";

export default function CalendarView({ tasks, gcalEvents, gcalConnected, setGcalConnected, onSelectTask, onAddTaskForDate }: {
  tasks: Task[];
  gcalEvents: GCalEvent[];
  gcalConnected: boolean;
  setGcalConnected: (v: boolean) => void;
  onSelectTask: (taskId: string) => void;
  onAddTaskForDate: (date: string) => void;
}) {
  const [cur, setCur] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
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
              const now = new Date(); const isToday = year === now.getFullYear() && month === now.getMonth() && day === now.getDate();
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
