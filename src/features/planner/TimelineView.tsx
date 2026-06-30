import { useRef, useState } from "react";
import { motion } from "motion/react";
import { MapPin, Repeat } from "lucide-react";
import { PRIORITY_CFG, RECURRENCE_LABELS } from "@/constants";
import {
  toISO, parseISO, addDaysISO, daysInWindow, taskStartISO, taskStartMinutes,
  taskDurationMin, tasksInWindow, minutesToTime, snap, packLanes, type TimeWindow,
} from "@/lib/timeWindow";
import { usePointerDrag } from "./usePointerDrag";
import TimeGridSurface, { HOUR_START, HOUR_END } from "./TimeGridSurface";
import type { Task } from "@/types";

interface Props {
  tasks: Task[];
  window: TimeWindow;
  onSelectTask: (id: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onCreateAt: (date: string, startTime?: string, durationMin?: number) => void;
}

// ── Day level: horizontal time axis, bar length = duration, lane-packed ───────

const SPAN_MIN = (HOUR_END - HOUR_START) * 60;
const DAY_ROW_H = 46;
const DAY_ROW_GAP = 6;

function DailyTimeline({ tasks, window, onSelectTask, onUpdateTask, onCreateAt }: Props) {
  const dayISO = toISO(window.start);
  const items = tasksInWindow(tasks, window);
  const trackRef = useRef<HTMLDivElement>(null);
  const pointer = usePointerDrag();
  const [drag, setDrag] = useState<{ id: string; mode: "move" | "resize"; min: number; dur: number } | null>(null);
  const [create, setCreate] = useState<{ a: number; b: number } | null>(null);
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);

  const trackW = () => trackRef.current?.clientWidth ?? 0;
  const dMinFromDx = (dx: number) => snap((dx / (trackW() || 1)) * SPAN_MIN, 15);
  const leftPct = (min: number) => ((min - HOUR_START * 60) / SPAN_MIN) * 100;
  const widthPct = (dur: number) => (dur / SPAN_MIN) * 100;

  const { packed, laneCount } = packLanes(items, taskStartMinutes, t => taskStartMinutes(t) + taskDurationMin(t));
  const laneOf = new Map(packed.map(p => [p.item.id, p.lane]));

  function beginDrag(e: React.PointerEvent, t: Task, mode: "move" | "resize") {
    const origMin = taskStartMinutes(t);
    const origDur = taskDurationMin(t);
    setDrag({ id: t.id, mode, min: origMin, dur: origDur });
    pointer.start(e, {
      onMove: (dx) => {
        const d = dMinFromDx(dx);
        setDrag({
          id: t.id, mode,
          min: mode === "move" ? Math.max(0, Math.min(24 * 60 - 15, origMin + d)) : origMin,
          dur: mode === "resize" ? Math.max(15, origDur + d) : origDur,
        });
      },
      onEnd: (dx) => {
        const d = dMinFromDx(dx);
        if (mode === "move") onUpdateTask(t.id, { startDate: dayISO, startTime: minutesToTime(Math.max(0, Math.min(24 * 60 - 15, origMin + d))) });
        else onUpdateTask(t.id, { durationMin: Math.max(15, origDur + d) });
        setDrag(null);
      },
    });
  }

  function beginCreate(e: React.PointerEvent) {
    // Only the empty track background creates; presses on a bar must not.
    if (e.target !== e.currentTarget) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const startMin = snap(HOUR_START * 60 + ((e.clientX - rect.left) / rect.width) * SPAN_MIN, 15);
    setCreate({ a: startMin, b: startMin });
    pointer.start(e, {
      onMove: (dx) => setCreate({ a: startMin, b: startMin + snap((dx / rect.width) * SPAN_MIN, 15) }),
      onEnd: (dx) => {
        const end = startMin + snap((dx / rect.width) * SPAN_MIN, 15);
        const lo = Math.max(0, Math.min(startMin, end));
        const hi = Math.max(startMin, end);
        const dur = hi - lo >= 15 ? hi - lo : 60;
        onCreateAt(dayISO, minutesToTime(lo), dur);
        setCreate(null);
      },
    });
  }

  const trackH = Math.max(1, laneCount) * (DAY_ROW_H + DAY_ROW_GAP);

  return (
    <div className="flex-1 overflow-y-auto px-8 py-5">
      <div className="flex text-[10px] text-muted-foreground mb-1">
        {hours.map(h => <div key={h} className="flex-1">{h}:00</div>)}
      </div>
      <div ref={trackRef} className="relative bg-secondary/20 rounded-lg cursor-pointer" style={{ height: trackH }} onPointerDown={beginCreate}>
        {/* hour gridlines */}
        {hours.slice(0, -1).map((_, i) => (
          <div key={i} className="absolute top-0 bottom-0 border-r border-border/40 pointer-events-none" style={{ left: `${(i / (hours.length - 1)) * 100}%` }} />
        ))}
        {create && (() => {
          const lo = Math.min(create.a, create.b), hi = Math.max(create.a, create.b);
          return <div className="absolute top-1 bottom-1 rounded-md border border-dashed border-accent bg-accent/10 pointer-events-none"
            style={{ left: `${leftPct(lo)}%`, width: `${Math.max(1, widthPct(hi - lo))}%` }} />;
        })()}
        {items.length === 0 && <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Nothing scheduled this day. Click or drag to add.</p>}
        {items.map(t => {
          const dragging = drag?.id === t.id;
          const startMin = dragging ? drag!.min : taskStartMinutes(t);
          const dur = dragging ? drag!.dur : taskDurationMin(t);
          const lane = laneOf.get(t.id) ?? 0;
          const cfg = PRIORITY_CFG[t.priority];
          return (
            <motion.div key={t.id}
              animate={dragging ? { scale: 1.03, boxShadow: "0 10px 24px rgba(0,0,0,0.25)", zIndex: 30 } : { scale: 1, boxShadow: "0 0 0 rgba(0,0,0,0)", zIndex: 1 }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              onClick={(e) => { e.stopPropagation(); if (!pointer.moved()) onSelectTask(t.id); }}
              onPointerDown={(e) => beginDrag(e, t, "move")}
              style={{ top: lane * (DAY_ROW_H + DAY_ROW_GAP), height: DAY_ROW_H, left: `${leftPct(startMin)}%`, width: `${Math.max(3, widthPct(dur))}%`, touchAction: "none" }}
              className={`absolute rounded-md border px-2 py-1 overflow-hidden cursor-grab active:cursor-grabbing select-none ${cfg.bg} ${cfg.border} ${t.status === "done" ? "opacity-60" : ""} ${dragging ? "" : "transition-[left,width] duration-150"}`}>
              <div className={`text-[11px] font-medium truncate ${cfg.color} ${t.status === "done" ? "line-through" : ""}`}>{t.title}</div>
              <div className="flex items-center gap-2 text-[9px] text-muted-foreground truncate">
                <span>{minutesToTime(startMin)}–{minutesToTime(Math.min(24 * 60 - 1, startMin + dur))}</span>
                {t.location && <span className="flex items-center gap-0.5 truncate"><MapPin size={8} /> {t.location}</span>}
              </div>
              <div onPointerDown={(e) => beginDrag(e, t, "resize")} className="absolute top-0 bottom-0 right-0 w-2 cursor-ew-resize" title="Drag to resize" />
            </motion.div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground mt-3 text-center">Bar length is the task's duration · drag to move · drag the right edge to resize · click or drag empty space to add</p>
    </div>
  );
}

// ── Week level: vertical time grid (shared surface, detailed variant) ─────────

function WeeklyTimeline({ tasks, window, onSelectTask, onUpdateTask, onCreateAt }: Props) {
  return (
    <TimeGridSurface
      days={daysInWindow(window)}
      tasks={tasks}
      variant="detailed"
      onSelectTask={onSelectTask}
      onReschedule={(id, startDate, startTime) => onUpdateTask(id, { startDate, startTime })}
      onResize={(id, durationMin) => onUpdateTask(id, { durationMin })}
      onCreateAt={(date, start, dur) => onCreateAt(date, start, dur)}
    />
  );
}

// ── Month level: recurrent lanes + packed non-recurrent span bars ─────────────

function MonthlyTimeline({ tasks, window, onSelectTask, onUpdateTask, onCreateAt }: Props) {
  const days = daysInWindow(window);
  const items = tasksInWindow(tasks, window);
  const recurrent = items.filter(t => t.recurrence !== "none");
  const oneoff = items.filter(t => t.recurrence === "none");
  const trackRef = useRef<HTMLDivElement>(null);
  const pointer = usePointerDrag();
  const [drag, setDrag] = useState<{ id: string; mode: "move" | "resize"; shift: number } | null>(null);
  const todayISOv = toISO(new Date());

  const colWidth = () => (trackRef.current ? trackRef.current.clientWidth / days.length : 0);
  function dayIndex(iso: string): number {
    const target = parseISO(iso).getTime();
    const idx = days.findIndex(d => d.getTime() === target);
    if (idx >= 0) return idx;
    return target < days[0].getTime() ? 0 : days.length - 1;
  }

  function beginDrag(e: React.PointerEvent, t: Task, mode: "move" | "resize") {
    const origStart = taskStartISO(t), origEnd = t.deadline;
    setDrag({ id: t.id, mode, shift: 0 });
    pointer.start(e, {
      onMove: (dx) => { const cw = colWidth(); setDrag({ id: t.id, mode, shift: cw ? Math.round(dx / cw) : 0 }); },
      onEnd: (dx) => {
        const cw = colWidth();
        const shift = cw ? Math.round(dx / cw) : 0;
        if (shift !== 0) {
          if (mode === "move") onUpdateTask(t.id, { startDate: addDaysISO(origStart, shift), deadline: addDaysISO(origEnd, shift) });
          else { const ne = addDaysISO(origEnd, shift); if (ne >= origStart) onUpdateTask(t.id, { deadline: ne }); }
        }
        setDrag(null);
      },
    });
  }

  // A single draggable span bar (start → deadline) within a track.
  const spanBar = (t: Task, opts?: { label?: boolean }) => {
    const dragging = drag?.id === t.id;
    const shift = dragging ? drag!.shift : 0;
    const startISO = dragging && drag!.mode === "move" ? addDaysISO(taskStartISO(t), shift) : taskStartISO(t);
    const endISO = dragging ? addDaysISO(t.deadline, shift) : t.deadline;
    const si = dayIndex(startISO);
    const ei = Math.max(si, dayIndex(endISO));
    const cfg = PRIORITY_CFG[t.priority];
    return (
      <motion.div key={t.id}
        animate={dragging ? { scale: 1.02, boxShadow: "0 10px 24px rgba(0,0,0,0.25)", zIndex: 30 } : { scale: 1, boxShadow: "0 0 0 rgba(0,0,0,0)", zIndex: 1 }}
        transition={{ type: "spring", damping: 30, stiffness: 350 }}
        onClick={(e) => { e.stopPropagation(); if (!pointer.moved()) onSelectTask(t.id); }}
        onPointerDown={(e) => beginDrag(e, t, "move")}
        style={{ left: `${(si / days.length) * 100}%`, width: `${((ei - si + 1) / days.length) * 100}%`, touchAction: "none" }}
        className={`absolute top-0.5 bottom-0.5 rounded border flex items-center gap-1 px-2 cursor-grab active:cursor-grabbing select-none ${cfg.bg} ${cfg.border} ${t.status === "done" ? "opacity-60" : ""} ${dragging ? "" : "transition-[left,width] duration-150"}`}>
        {opts?.label && t.recurrence !== "none" && <Repeat size={9} className={cfg.color} />}
        <span className={`text-[10px] font-medium truncate ${cfg.color} ${t.status === "done" ? "line-through" : ""}`}>{t.title}</span>
        <div onPointerDown={(e) => beginDrag(e, t, "resize")} className="absolute top-0 bottom-0 right-0 w-2 cursor-ew-resize" title="Drag to change deadline" />
      </motion.div>
    );
  };

  const gridBg = (
    <div className="absolute inset-0 flex">
      {days.map((d, i) => (
        <div key={i} onClick={() => onCreateAt(toISO(d))}
          className={`flex-1 border-r border-border/40 cursor-pointer hover:bg-accent/5 ${toISO(d) === todayISOv ? "bg-accent/5" : ""}`} />
      ))}
    </div>
  );

  const { packed, laneCount } = packLanes(oneoff, t => dayIndex(taskStartISO(t)), t => dayIndex(t.deadline));
  const ROW_H = 26;

  return (
    <div className="flex-1 overflow-y-auto px-8 py-5">
      {/* day axis */}
      <div ref={trackRef} className="flex mb-1">
        {days.map((d, i) => (
          <div key={i} className={`flex-1 text-center text-[10px] ${toISO(d) === todayISOv ? "text-accent font-semibold" : "text-muted-foreground"}`}>{d.getDate()}</div>
        ))}
      </div>

      {recurrent.length > 0 && (
        <div className="mb-4">
          <h3 className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5"><Repeat size={11} /> Recurring</h3>
          <div className="space-y-1">
            {recurrent.map(t => (
              <div key={t.id} className="flex items-center gap-3">
                <div className="w-[150px] shrink-0 text-xs truncate flex items-center gap-1.5" title={t.title}>
                  <span className="truncate">{t.title}</span>
                  <span className="text-[9px] text-muted-foreground shrink-0">{RECURRENCE_LABELS[t.recurrence]}</span>
                </div>
                <div className="flex-1 relative h-7">{gridBg}{spanBar(t, { label: false })}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        {recurrent.length > 0 && <h3 className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">Tasks</h3>}
        <div className="relative" style={{ height: Math.max(1, laneCount) * (ROW_H + 4) }}>
          {gridBg}
          {oneoff.length === 0 && <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Nothing scheduled. Click a day to add.</p>}
          {packed.map(({ item, lane }) => (
            <div key={item.id} className="absolute left-0 right-0" style={{ top: lane * (ROW_H + 4), height: ROW_H }}>
              {spanBar(item)}
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mt-3 text-center">Bars run from start date to deadline · drag to move · drag the right edge to change the deadline · click a day to add</p>
    </div>
  );
}

export default function TimelineView(props: Props) {
  if (props.window.level === "day") return <DailyTimeline {...props} />;
  if (props.window.level === "week") return <WeeklyTimeline {...props} />;
  return <MonthlyTimeline {...props} />;
}
