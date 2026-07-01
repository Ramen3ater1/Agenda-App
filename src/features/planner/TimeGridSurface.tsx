import { useRef, useState } from "react";
import { motion } from "motion/react";
import { MapPin } from "lucide-react";
import { PRIORITY_CFG } from "@/constants";
import {
  toISO, taskStartISO, isAllDay, taskStartMinutes, taskDurationMin,
  minutesToTime, timeToMinutes, snap,
} from "@/lib/timeWindow";
import { usePointerDrag } from "./usePointerDrag";
import type { Task, GCalEvent } from "@/types";

export const HOUR_START = 7;
export const HOUR_END = 21; // grid covers 07:00–21:00

// A vertical time grid (hours down the left, one column per day). Blocks are
// positioned by start time and sized by duration. Shared by the calendar
// (compact) and the weekly timeline (detailed — taller rows + more info).
export default function TimeGridSurface({
  days, tasks, variant = "compact", gcalEvents = [], gcalConnected = false,
  onSelectTask, onReschedule, onResize, onCreateAt,
}: {
  days: Date[];
  tasks: Task[];
  variant?: "compact" | "detailed";
  gcalEvents?: GCalEvent[];
  gcalConnected?: boolean;
  onSelectTask: (id: string) => void;
  onReschedule: (id: string, startDate: string, startTime: string) => void;
  onResize: (id: string, durationMin: number) => void;
  onCreateAt: (date: string, startTime: string, durationMin: number) => void;
}) {
  const detailed = variant === "detailed";
  const HOUR_H = detailed ? 64 : 44;
  const MIN_BLOCK = detailed ? 46 : 18;
  const GRID_H = (HOUR_END - HOUR_START) * HOUR_H;
  const minToY = (min: number) => ((min - HOUR_START * 60) / 60) * HOUR_H;

  const colsRef = useRef<HTMLDivElement>(null);
  const pointer = usePointerDrag();
  const [drag, setDrag] = useState<
    { id: string; mode: "move" | "resize"; day: number; min: number; dur: number } | null
  >(null);
  const [create, setCreate] = useState<{ day: number; a: number; b: number } | null>(null);

  const todayISOv = toISO(new Date());
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

  const timedByDay = (di: number) => tasks.filter(t => !isAllDay(t) && taskStartISO(t) === toISO(days[di]));
  const allDayByDay = (di: number) => tasks.filter(t => isAllDay(t) && taskStartISO(t) === toISO(days[di]));
  const gEventsByDay = (di: number) => (gcalConnected ? gcalEvents.filter(e => e.date === toISO(days[di])) : []);
  const allDayEventsByDay = (di: number) => gEventsByDay(di).filter(e => !e.startTime);
  const timedEventsByDay = (di: number) => gEventsByDay(di).filter(e => e.startTime);

  const colWidth = () => (colsRef.current ? colsRef.current.clientWidth / days.length : 0);
  const deltaMinFromDy = (dy: number) => snap((dy / HOUR_H) * 60, 15);

  function beginBlockDrag(e: React.PointerEvent, t: Task, dayIdx: number, mode: "move" | "resize") {
    const origMin = taskStartMinutes(t);
    const origDur = taskDurationMin(t);
    setDrag({ id: t.id, mode, day: dayIdx, min: origMin, dur: origDur });
    pointer.start(e, {
      onMove: (dx, dy) => {
        const dMin = deltaMinFromDy(dy);
        const cw = colWidth();
        const dayShift = mode === "move" && cw ? Math.round(dx / cw) : 0;
        setDrag({
          id: t.id, mode,
          day: Math.max(0, Math.min(days.length - 1, dayIdx + dayShift)),
          min: mode === "move" ? Math.max(0, Math.min(24 * 60 - 15, origMin + dMin)) : origMin,
          dur: mode === "resize" ? Math.max(15, origDur + dMin) : origDur,
        });
      },
      onEnd: (dx, dy) => {
        const dMin = deltaMinFromDy(dy);
        const cw = colWidth();
        if (mode === "move") {
          const dayShift = cw ? Math.round(dx / cw) : 0;
          const day = Math.max(0, Math.min(days.length - 1, dayIdx + dayShift));
          const min = Math.max(0, Math.min(24 * 60 - 15, origMin + dMin));
          // Skip the no-op write a plain click would otherwise trigger.
          if (day !== dayIdx || min !== origMin) onReschedule(t.id, toISO(days[day]), minutesToTime(min));
        } else {
          const next = Math.max(15, origDur + dMin);
          if (next !== origDur) onResize(t.id, next);
        }
        setDrag(null);
      },
    });
  }

  function beginCreate(e: React.PointerEvent, dayIdx: number) {
    // Only the empty column background creates a task; presses on a block (a
    // descendant) must not, even if their stopPropagation is missed.
    if (e.target !== e.currentTarget) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const startMin = snap(HOUR_START * 60 + ((e.clientY - rect.top) / HOUR_H) * 60, 15);
    setCreate({ day: dayIdx, a: startMin, b: startMin });
    pointer.start(e, {
      onMove: (_dx, dy) => setCreate({ day: dayIdx, a: startMin, b: startMin + deltaMinFromDy(dy) }),
      onEnd: (_dx, dy) => {
        const endMin = startMin + deltaMinFromDy(dy);
        const lo = Math.max(0, Math.min(startMin, endMin));
        const hi = Math.max(startMin, endMin);
        const dur = hi - lo >= 15 ? hi - lo : 60;
        onCreateAt(toISO(days[dayIdx]), minutesToTime(lo), dur);
        setCreate(null);
      },
    });
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-4">
      {/* Day headers + all-day strip */}
      <div className="flex sticky top-0 bg-background z-10 pb-1">
        <div className="w-12 shrink-0" />
        <div className="flex flex-1">
          {days.map((d, di) => {
            const isToday = toISO(d) === todayISOv;
            return (
              <div key={di} className="flex-1 text-center pb-1">
                <div className="text-[11px] text-muted-foreground">{d.toLocaleDateString("en-US", { weekday: "short" })}</div>
                <div className={`text-sm font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? "bg-accent text-white" : ""}`}>{d.getDate()}</div>
                <div className="mt-1 space-y-0.5 px-1">
                  {allDayByDay(di).map(t => (
                    <div key={t.id} onClick={() => onSelectTask(t.id)}
                      className={`text-[9px] px-1 py-0.5 rounded truncate cursor-pointer ${PRIORITY_CFG[t.priority].bg} ${PRIORITY_CFG[t.priority].color}`}>{t.title}</div>
                  ))}
                  {allDayEventsByDay(di).map(ev => (
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
        <div className="w-12 shrink-0 relative">
          {hours.map(h => (
            <div key={h} className="absolute -translate-y-1/2 right-1 text-[10px] text-muted-foreground" style={{ top: minToY(h * 60) }}>{h}:00</div>
          ))}
        </div>
        <div ref={colsRef} className="flex flex-1 relative border-l border-border">
          {hours.map(h => (
            <div key={h} className="absolute left-0 right-0 border-t border-border/60 pointer-events-none" style={{ top: minToY(h * 60) }} />
          ))}
          {days.map((_, di) => (
            <div key={di} className="flex-1 relative border-r border-border/60 cursor-pointer"
              onPointerDown={(e) => beginCreate(e, di)}>
              {/* create ghost */}
              {create && create.day === di && (() => {
                const lo = Math.min(create.a, create.b), hi = Math.max(create.a, create.b);
                return (
                  <div className="absolute left-1 right-1 rounded-md border border-dashed border-accent bg-accent/10 pointer-events-none"
                    style={{ top: minToY(lo), height: Math.max(MIN_BLOCK, ((hi - lo) / 60) * HOUR_H) }} />
                );
              })()}

              {timedByDay(di).map(t => {
                const dragging = drag?.id === t.id;
                const startMin = dragging ? drag!.min : taskStartMinutes(t);
                const dur = dragging ? drag!.dur : taskDurationMin(t);
                const cfg = PRIORITY_CFG[t.priority];
                const endMin = startMin + dur;
                // While moving across days, keep the block mounted in its own
                // column (so pointer capture survives) and slide it over the
                // target day with a transform.
                const xOffset = dragging && drag!.mode === "move" ? (drag!.day - di) * colWidth() : 0;
                return (
                  <motion.div key={t.id}
                    animate={dragging
                      ? { scale: 1.03, boxShadow: "0 10px 24px rgba(0,0,0,0.25)", zIndex: 30, x: xOffset }
                      : { scale: 1, boxShadow: "0 0 0 rgba(0,0,0,0)", zIndex: 1, x: 0 }}
                    transition={{ type: "spring", damping: 30, stiffness: 350 }}
                    onClick={(e) => { e.stopPropagation(); if (!pointer.moved()) onSelectTask(t.id); }}
                    onPointerDown={(e) => beginBlockDrag(e, t, di, "move")}
                    style={{ top: minToY(startMin), height: Math.max(MIN_BLOCK, (dur / 60) * HOUR_H), touchAction: "none" }}
                    className={`absolute left-1 right-1 rounded-md border px-1.5 py-1 overflow-hidden cursor-grab active:cursor-grabbing select-none ${cfg.bg} ${cfg.border} ${t.status === "done" ? "opacity-60" : ""} ${dragging ? "" : "transition-[top,height] duration-150"}`}>
                    <div className={`text-[10px] font-medium truncate ${cfg.color} ${t.status === "done" ? "line-through" : ""}`}>{t.title}</div>
                    <div className="text-[9px] text-muted-foreground">{minutesToTime(startMin)}{detailed ? `–${minutesToTime(Math.min(24 * 60 - 1, endMin))}` : ""}</div>
                    {detailed && t.location && (
                      <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground truncate"><MapPin size={8} /> {t.location}</div>
                    )}
                    <div onPointerDown={(e) => beginBlockDrag(e, t, di, "resize")}
                      className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize" title="Drag to resize" />
                  </motion.div>
                );
              })}

              {/* read-only Google Calendar events */}
              {timedEventsByDay(di).map(ev => {
                const startMin = timeToMinutes(ev.startTime!);
                const dur = ev.durationMin ?? 60;
                return (
                  <div key={ev.id} title={`${ev.title}${ev.location ? ` · ${ev.location}` : ""}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{ top: minToY(startMin), height: Math.max(MIN_BLOCK, (dur / 60) * HOUR_H) }}
                    className="absolute left-1 right-1 rounded-md border border-blue-300/60 border-dashed bg-blue-50/80 px-1.5 py-1 overflow-hidden cursor-default z-[2]">
                    <div className="text-[10px] font-medium truncate text-blue-700">{ev.title}</div>
                    <div className="text-[9px] text-blue-500/80">{ev.time}</div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mt-3 text-center">Drag a block to reschedule · drag its bottom edge to resize · click or drag an empty slot to add</p>
    </div>
  );
}
