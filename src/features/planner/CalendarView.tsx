import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { PRIORITY_CFG } from "@/constants";
import {
  toISO, daysInWindow, taskStartISO, isAllDay, taskStartMinutes, taskDurationMin,
  minutesToTime, snap, type TimeWindow,
} from "@/lib/timeWindow";
import type { Task, GCalEvent } from "@/types";

const HOUR_START = 7;
const HOUR_END = 21;          // grid covers 07:00–21:00
const HOUR_H = 44;            // px per hour
const GRID_H = (HOUR_END - HOUR_START) * HOUR_H;

function minToY(min: number) { return ((min - HOUR_START * 60) / 60) * HOUR_H; }

interface ViewProps {
  tasks: Task[];
  window: TimeWindow;
  gcalEvents: GCalEvent[];
  gcalConnected: boolean;
  onSelectTask: (id: string) => void;
  onAddTaskForDate: (date: string, startTime?: string) => void;
  onReschedule: (id: string, startDate: string, startTime: string) => void;
  onResize: (id: string, durationMin: number) => void;
}

// ── Month grid ───────────────────────────────────────────────────────────────

function MonthGrid({ tasks, window, gcalEvents, gcalConnected, onSelectTask, onAddTaskForDate }: ViewProps) {
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
              <button onClick={() => onAddTaskForDate(dateStr(day))} title="Add task"
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

// ── Day / Week hour grid (drag to move, resize bottom edge, click to create) ─

interface DragState {
  id: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  origMin: number;
  origDur: number;
  origDay: number;
  curMin: number;
  curDur: number;
  curDay: number;
}

function TimeGrid({ tasks, window, gcalEvents, gcalConnected, onSelectTask, onAddTaskForDate, onReschedule, onResize }: ViewProps) {
  const days = daysInWindow(window);
  const colsRef = useRef<HTMLDivElement>(null);
  const movedRef = useRef(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const todayISOv = toISO(new Date());
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

  const timedByDay = (di: number) =>
    tasks.filter(t => !isAllDay(t) && taskStartISO(t) === toISO(days[di]));
  const allDayByDay = (di: number) =>
    tasks.filter(t => isAllDay(t) && taskStartISO(t) === toISO(days[di]));
  const eventsByDay = (di: number) =>
    gcalConnected ? gcalEvents.filter(e => e.date === toISO(days[di])) : [];

  function colWidth() {
    const el = colsRef.current;
    return el ? el.clientWidth / days.length : 0;
  }

  function beginDrag(e: React.PointerEvent, t: Task, dayIdx: number, mode: "move" | "resize") {
    e.stopPropagation();
    movedRef.current = false;
    setDrag({
      id: t.id, mode, startX: e.clientX, startY: e.clientY,
      origMin: taskStartMinutes(t), origDur: taskDurationMin(t), origDay: dayIdx,
      curMin: taskStartMinutes(t), curDur: taskDurationMin(t), curDay: dayIdx,
    });
  }

  useEffect(() => {
    if (!drag) return;
    function onMove(e: PointerEvent) {
      if (Math.abs(e.clientX - drag!.startX) > 4 || Math.abs(e.clientY - drag!.startY) > 4) movedRef.current = true;
      const deltaMin = snap(((e.clientY - drag!.startY) / HOUR_H) * 60, 15);
      const cw = colWidth();
      const dayShift = cw ? Math.round((e.clientX - drag!.startX) / cw) : 0;
      setDrag(d => d && ({
        ...d,
        curMin: d.mode === "move" ? Math.max(0, Math.min(24 * 60 - 30, d.origMin + deltaMin)) : d.origMin,
        curDur: d.mode === "resize" ? Math.max(15, d.origDur + deltaMin) : d.origDur,
        curDay: d.mode === "move" ? Math.max(0, Math.min(days.length - 1, d.origDay + dayShift)) : d.origDay,
      }));
    }
    function onUp() {
      setDrag(d => {
        if (d) {
          if (d.mode === "move") onReschedule(d.id, toISO(days[d.curDay]), minutesToTime(d.curMin));
          else onResize(d.id, d.curDur);
        }
        return null;
      });
      // Let the click that follows pointerup see the moved flag, then clear it.
      setTimeout(() => { movedRef.current = false; }, 0);
    }
    globalThis.addEventListener("pointermove", onMove);
    globalThis.addEventListener("pointerup", onUp, { once: true });
    return () => { globalThis.removeEventListener("pointermove", onMove); globalThis.removeEventListener("pointerup", onUp); };
  }, [drag?.id, drag?.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  function createAt(e: React.MouseEvent, dayIdx: number) {
    if (movedRef.current) return; // ignore the click that ends a drag
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const min = snap(HOUR_START * 60 + ((e.clientY - rect.top) / HOUR_H) * 60, 30);
    onAddTaskForDate(toISO(days[dayIdx]), minutesToTime(min));
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-4">
      {/* Day headers */}
      <div className="flex sticky top-0 bg-background z-10 pb-1">
        <div className="w-12 shrink-0" />
        <div className="flex flex-1">
          {days.map((d, di) => {
            const isToday = toISO(d) === todayISOv;
            return (
              <div key={di} className="flex-1 text-center pb-1">
                <div className="text-[11px] text-muted-foreground">{d.toLocaleDateString("en-US", { weekday: "short" })}</div>
                <div className={`text-sm font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? "bg-accent text-white" : ""}`}>{d.getDate()}</div>
                {/* all-day strip */}
                <div className="mt-1 space-y-0.5 px-1">
                  {allDayByDay(di).map(t => (
                    <div key={t.id} onClick={() => onSelectTask(t.id)}
                      className={`text-[9px] px-1 py-0.5 rounded truncate cursor-pointer ${PRIORITY_CFG[t.priority].bg} ${PRIORITY_CFG[t.priority].color}`}>{t.title}</div>
                  ))}
                  {eventsByDay(di).map(ev => (
                    <div key={ev.id} className="text-[9px] px-1 py-0.5 rounded truncate bg-blue-50 text-blue-700">{ev.title}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hour grid */}
      <div className="flex" style={{ height: GRID_H }}>
        {/* hour gutter */}
        <div className="w-12 shrink-0 relative">
          {hours.map(h => (
            <div key={h} className="absolute -translate-y-1/2 right-1 text-[10px] text-muted-foreground" style={{ top: minToY(h * 60) }}>
              {h}:00
            </div>
          ))}
        </div>
        {/* columns */}
        <div ref={colsRef} className="flex flex-1 relative border-l border-border">
          {/* hour lines */}
          {hours.map(h => (
            <div key={h} className="absolute left-0 right-0 border-t border-border/60" style={{ top: minToY(h * 60) }} />
          ))}
          {days.map((_, di) => (
            <div key={di} className="flex-1 relative border-r border-border/60" onClick={(e) => createAt(e, di)}>
              {timedByDay(di).map(t => {
                const dragging = drag?.id === t.id;
                const startMin = dragging ? drag!.curMin : taskStartMinutes(t);
                const dur = dragging ? drag!.curDur : taskDurationMin(t);
                const dayIdx = dragging ? drag!.curDay : di;
                if (dragging && dayIdx !== di) return null; // render on the previewed column instead
                const cfg = PRIORITY_CFG[t.priority];
                return (
                  <div key={t.id}
                    onClick={(e) => { e.stopPropagation(); if (!movedRef.current) onSelectTask(t.id); }}
                    onPointerDown={(e) => beginDrag(e, t, di, "move")}
                    className={`absolute left-1 right-1 rounded-md border px-1.5 py-1 overflow-hidden cursor-grab active:cursor-grabbing select-none ${cfg.bg} ${cfg.border} ${t.status === "done" ? "opacity-60" : ""}`}
                    style={{ top: minToY(startMin), height: Math.max(18, (dur / 60) * HOUR_H) }}>
                    <div className={`text-[10px] font-medium truncate ${cfg.color} ${t.status === "done" ? "line-through" : ""}`}>{t.title}</div>
                    <div className="text-[9px] text-muted-foreground">{minutesToTime(startMin)}</div>
                    <div onPointerDown={(e) => beginDrag(e, t, di, "resize")}
                      className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize" title="Drag to resize" />
                  </div>
                );
              })}
              {/* dragged block previewed onto a different column */}
              {drag && drag.mode === "move" && drag.curDay === di && (() => {
                const t = tasks.find(x => x.id === drag.id);
                if (!t || taskStartISO(t) === toISO(days[di])) return null;
                const cfg = PRIORITY_CFG[t.priority];
                return (
                  <div className={`absolute left-1 right-1 rounded-md border px-1.5 py-1 overflow-hidden opacity-80 ${cfg.bg} ${cfg.border}`}
                    style={{ top: minToY(drag.curMin), height: Math.max(18, (drag.curDur / 60) * HOUR_H) }}>
                    <div className={`text-[10px] font-medium truncate ${cfg.color}`}>{t.title}</div>
                    <div className="text-[9px] text-muted-foreground">{minutesToTime(drag.curMin)}</div>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mt-3 text-center">Drag a block to reschedule · drag its bottom edge to resize · click an empty slot to add</p>
    </div>
  );
}

export default function CalendarView(props: ViewProps) {
  return props.window.level === "month" ? <MonthGrid {...props} /> : <TimeGrid {...props} />;
}
