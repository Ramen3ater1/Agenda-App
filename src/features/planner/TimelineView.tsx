import { useEffect, useRef, useState } from "react";
import { PRIORITY_CFG } from "@/constants";
import {
  toISO, parseISO, addDaysISO, daysInWindow, taskStartISO, taskStartMinutes,
  taskDurationMin, tasksInWindow, type TimeWindow,
} from "@/lib/timeWindow";
import { orderTasks } from "@/lib/utils";
import type { Task } from "@/types";

const HOUR_START = 7;
const HOUR_END = 21;

interface Props {
  tasks: Task[];
  window: TimeWindow;
  onSelectTask: (id: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
}

// Index of an ISO date within the window's day list, clamped to [0, len-1].
function dayIndex(days: Date[], iso: string): number {
  const target = parseISO(iso).getTime();
  let idx = days.findIndex(d => d.getTime() === target);
  if (idx >= 0) return idx;
  // clamp out-of-window dates to the nearest edge
  if (target < days[0].getTime()) return 0;
  return days.length - 1;
}

interface DragState {
  id: string;
  mode: "move" | "resize";
  startX: number;
  origStart: string;   // startDate ISO
  origEnd: string;     // deadline ISO
  shiftDays: number;
}

// ── Day level: intraday bars (read-only, click to open) ──────────────────────

function DayTimeline({ tasks, window, onSelectTask }: Props) {
  const items = orderTasks(tasksInWindow(tasks, window));
  const span = (HOUR_END - HOUR_START) * 60;
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);

  return (
    <div className="flex-1 overflow-y-auto px-8 py-5">
      <div className="flex text-[10px] text-muted-foreground mb-1 pl-[200px]">
        {hours.map(h => <div key={h} className="flex-1">{h}:00</div>)}
      </div>
      <div className="space-y-1.5">
        {items.length === 0 && <p className="text-center py-16 text-sm text-muted-foreground">Nothing scheduled this day.</p>}
        {items.map(t => {
          const startMin = taskStartMinutes(t);
          const dur = taskDurationMin(t);
          const left = Math.max(0, ((startMin - HOUR_START * 60) / span) * 100);
          const width = Math.min(100 - left, (dur / span) * 100);
          const cfg = PRIORITY_CFG[t.priority];
          return (
            <div key={t.id} className="flex items-center">
              <div className="w-[200px] shrink-0 pr-3 text-sm truncate">{t.title}</div>
              <div className="flex-1 relative h-7 bg-secondary/40 rounded">
                <div onClick={() => onSelectTask(t.id)}
                  className={`absolute top-0.5 bottom-0.5 rounded border px-2 flex items-center cursor-pointer hover:brightness-95 ${cfg.bg} ${cfg.border}`}
                  style={{ left: `${left}%`, width: `${Math.max(4, width)}%` }}>
                  <span className={`text-[10px] font-medium truncate ${cfg.color}`}>{t.startTime ?? ""}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Week / Month level: multi-day span bars (start → deadline) with drag ─────

function SpanTimeline({ tasks, window, onSelectTask, onUpdateTask }: Props) {
  const days = daysInWindow(window);
  const items = orderTasks(tasksInWindow(tasks, window));
  const trackRef = useRef<HTMLDivElement>(null);
  const movedRef = useRef(false);
  const [drag, setDrag] = useState<DragState | null>(null);

  function colWidth() {
    const el = trackRef.current;
    return el ? el.clientWidth / days.length : 0;
  }

  function beginDrag(e: React.PointerEvent, t: Task, mode: "move" | "resize") {
    e.stopPropagation();
    movedRef.current = false;
    setDrag({ id: t.id, mode, startX: e.clientX, origStart: taskStartISO(t), origEnd: t.deadline, shiftDays: 0 });
  }

  useEffect(() => {
    if (!drag) return;
    function onMove(e: PointerEvent) {
      if (Math.abs(e.clientX - drag!.startX) > 4) movedRef.current = true;
      const cw = colWidth();
      const shift = cw ? Math.round((e.clientX - drag!.startX) / cw) : 0;
      setDrag(d => d && ({ ...d, shiftDays: shift }));
    }
    function onUp() {
      setDrag(d => {
        if (d && d.shiftDays !== 0) {
          if (d.mode === "move") {
            onUpdateTask(d.id, { startDate: addDaysISO(d.origStart, d.shiftDays), deadline: addDaysISO(d.origEnd, d.shiftDays) });
          } else {
            const newEnd = addDaysISO(d.origEnd, d.shiftDays);
            if (newEnd >= d.origStart) onUpdateTask(d.id, { deadline: newEnd });
          }
        }
        return null;
      });
      setTimeout(() => { movedRef.current = false; }, 0);
    }
    globalThis.addEventListener("pointermove", onMove);
    globalThis.addEventListener("pointerup", onUp, { once: true });
    return () => { globalThis.removeEventListener("pointermove", onMove); globalThis.removeEventListener("pointerup", onUp); };
  }, [drag?.id, drag?.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const todayISOv = toISO(new Date());

  return (
    <div className="flex-1 overflow-y-auto px-8 py-5">
      {/* day axis */}
      <div className="flex pl-[200px] mb-1">
        <div className="flex flex-1">
          {days.map((d, i) => (
            <div key={i} className={`flex-1 text-center text-[10px] ${toISO(d) === todayISOv ? "text-accent font-semibold" : "text-muted-foreground"}`}>
              {window.level === "week" ? d.toLocaleDateString("en-US", { weekday: "short" }) : d.getDate()}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        {items.length === 0 && <p className="text-center py-16 text-sm text-muted-foreground">Nothing scheduled this period.</p>}
        {items.map(t => {
          const dragging = drag?.id === t.id;
          const shift = dragging ? drag!.shiftDays : 0;
          const startISO = dragging && drag!.mode === "move" ? addDaysISO(taskStartISO(t), shift) : taskStartISO(t);
          const endISO = dragging ? addDaysISO(t.deadline, drag!.mode === "move" ? shift : shift) : t.deadline;
          const si = dayIndex(days, startISO);
          const ei = Math.max(si, dayIndex(days, endISO));
          const left = (si / days.length) * 100;
          const width = ((ei - si + 1) / days.length) * 100;
          const cfg = PRIORITY_CFG[t.priority];
          return (
            <div key={t.id} className="flex items-center">
              <div className="w-[200px] shrink-0 pr-3 text-sm truncate" title={t.title}>{t.title}</div>
              <div ref={items[0].id === t.id ? trackRef : undefined} className="flex-1 relative h-7">
                <div className="absolute inset-0 flex">
                  {days.map((d, i) => <div key={i} className={`flex-1 border-r border-border/40 ${toISO(d) === todayISOv ? "bg-accent/5" : ""}`} />)}
                </div>
                <div
                  onClick={(e) => { e.stopPropagation(); if (!movedRef.current) onSelectTask(t.id); }}
                  onPointerDown={(e) => beginDrag(e, t, "move")}
                  className={`absolute top-0.5 bottom-0.5 rounded border flex items-center px-2 cursor-grab active:cursor-grabbing select-none ${cfg.bg} ${cfg.border} ${t.status === "done" ? "opacity-60" : ""}`}
                  style={{ left: `${left}%`, width: `${Math.max(3, width)}%` }}>
                  <span className={`text-[10px] font-medium truncate ${cfg.color} ${t.status === "done" ? "line-through" : ""}`}>{t.title}</span>
                  <div onPointerDown={(e) => beginDrag(e, t, "resize")}
                    className="absolute top-0 bottom-0 right-0 w-2 cursor-ew-resize" title="Drag to change deadline" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground mt-3 text-center">Bars run from start date to deadline · drag to move · drag the right edge to change the deadline</p>
    </div>
  );
}

export default function TimelineView(props: Props) {
  return props.window.level === "day" ? <DayTimeline {...props} /> : <SpanTimeline {...props} />;
}
