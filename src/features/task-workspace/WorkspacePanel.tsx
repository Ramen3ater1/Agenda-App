import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Play, Pause, Square,
  Plus, Check, X, Link2, FileText, StickyNote,
} from "lucide-react";
import { formatDuration, formatDate, uid } from "@/lib/utils";
import type { Task, Workspace, ResourceType } from "@/types";

const RING_R = 58;
const RING_C = 2 * Math.PI * RING_R;

export default function WorkspacePanel({
  task, workspace,
  onUpdateTask,
  timerElapsed, timerRunning, timerWorkspaceId,
  onStartFocus, onPause, onRequestEnd, onUpdateWorkspace,
}: {
  task: Task;
  workspace?: Workspace;
  onUpdateTask: (updates: Partial<Task>) => void;
  timerElapsed: number;
  timerRunning: boolean;
  timerWorkspaceId: string | null;
  onStartFocus: () => void;
  onPause: () => void;
  onRequestEnd: (workspaceId: string) => void;
  onUpdateWorkspace: (wsId: string, updates: Partial<Workspace>) => void;
}) {
  const [addingRes, setAddingRes] = useState(false);
  const [newRes, setNewRes] = useState({ type: "link" as ResourceType, title: "", value: "" });

  const [pomodoro, setPomodoro] = useState(() => localStorage.getItem("ff_pomodoro") === "1");
  const [workMin, setWorkMin] = useState(() => Number(localStorage.getItem("ff_pomo_work")) || 25);
  const [breakMin, setBreakMin] = useState(() => Number(localStorage.getItem("ff_pomo_break")) || 5);
  useEffect(() => { localStorage.setItem("ff_pomodoro", pomodoro ? "1" : "0"); }, [pomodoro]);
  useEffect(() => { localStorage.setItem("ff_pomo_work", String(workMin)); }, [workMin]);
  useEffect(() => { localStorage.setItem("ff_pomo_break", String(breakMin)); }, [breakMin]);

  const isThisWorkspace = workspace != null && timerWorkspaceId === workspace.id;
  const isRunning = timerRunning && isThisWorkspace;
  const effectiveElapsed = isThisWorkspace ? timerElapsed : 0;
  const totalLogged = (workspace?.sessions.reduce((a, s) => a + s.duration, 0) ?? 0) + effectiveElapsed;

  // Pomodoro phase derivation from the running elapsed seconds.
  const workSec = Math.max(1, workMin) * 60;
  const breakSec = Math.max(1, breakMin) * 60;
  const cycle = workSec + breakSec;
  let phase: "work" | "break" = "work";
  let phaseElapsed = 0;
  let phaseTotal = workSec;
  if (pomodoro) {
    const pos = effectiveElapsed % cycle;
    if (pos < workSec) { phase = "work"; phaseElapsed = pos; phaseTotal = workSec; }
    else { phase = "break"; phaseElapsed = pos - workSec; phaseTotal = breakSec; }
  }
  const ringPct = pomodoro && phaseTotal > 0 ? phaseElapsed / phaseTotal : 0;
  const displaySeconds = pomodoro ? Math.max(0, phaseTotal - phaseElapsed) : effectiveElapsed;
  const ringColor = phase === "break" ? "text-emerald-500" : "text-accent";

  // Notify when a Pomodoro phase flips while the timer is running.
  const prevPhase = useRef(phase);
  useEffect(() => {
    if (!pomodoro || !isRunning) { prevPhase.current = phase; return; }
    if (prevPhase.current !== phase) {
      toast(phase === "break" ? "Break time — step away ☕" : "Back to work 🍅");
      prevPhase.current = phase;
    }
  }, [phase, pomodoro, isRunning]);

  function toggleStep(id: string) { onUpdateTask({ steps: task.steps.map(s => s.id === id ? { ...s, done: !s.done } : s) }); }

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
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[880px] mx-auto px-8 py-6 space-y-5">
        <h1 className="text-xl font-semibold px-1">{task.title}</h1>

        <div className="bg-card rounded-lg border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Focus session</div>
            {isRunning && <span className="flex items-center gap-1 text-[11px] text-emerald-600"><div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Recording</span>}
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="relative size-[140px]">
              <svg className="size-full -rotate-90" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r={RING_R} fill="none" strokeWidth={8} stroke="currentColor" className="text-secondary" />
                {pomodoro && (
                  <circle
                    cx="70" cy="70" r={RING_R} fill="none" strokeWidth={8} strokeLinecap="round"
                    stroke="currentColor" className={ringColor}
                    strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - ringPct)}
                    style={{ transition: "stroke-dashoffset 1s linear" }}
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="font-mono text-2xl font-medium tracking-tight leading-none">{formatDuration(displaySeconds)}</div>
                {pomodoro && <div className={`mt-1.5 text-[10px] uppercase tracking-widest font-mono ${phase === "break" ? "text-emerald-600" : "text-accent"}`}>{phase}</div>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Pomodoro</span>
              <button
                role="switch" aria-checked={pomodoro} onClick={() => setPomodoro(v => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${pomodoro ? "bg-accent" : "bg-secondary"}`}
              >
                <span className={`inline-block size-4 transform rounded-full bg-white shadow transition-transform ${pomodoro ? "translate-x-[18px]" : "translate-x-0.5"}`} />
              </button>
            </div>

            {pomodoro && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <label className="flex items-center gap-1.5">Work
                  <input type="number" min={1} value={workMin} onChange={e => setWorkMin(Math.max(1, Number(e.target.value) || 1))} className="w-14 px-2 py-1 border border-border rounded bg-background text-center text-foreground outline-none focus:ring-1 focus:ring-accent/30" /> min
                </label>
                <label className="flex items-center gap-1.5">Break
                  <input type="number" min={1} value={breakMin} onChange={e => setBreakMin(Math.max(1, Number(e.target.value) || 1))} className="w-14 px-2 py-1 border border-border rounded bg-background text-center text-foreground outline-none focus:ring-1 focus:ring-accent/30" /> min
                </label>
              </div>
            )}

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

            <div className="text-xs text-muted-foreground font-mono">Total logged: {formatDuration(totalLogged)}</div>
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <span className="text-xs font-medium block mb-2">Steps</span>
            <div className="space-y-1.5">
              {task.steps.map(step => (
                <div key={step.id} className="flex items-center gap-2.5 border border-border rounded-md px-3 py-2 bg-background">
                  <div onClick={() => toggleStep(step.id)} className={`shrink-0 size-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${step.done ? "bg-accent border-accent" : "border-border hover:border-foreground/40"}`}>
                    {step.done && <Check size={9} className="text-white" />}
                  </div>
                  <span onClick={() => toggleStep(step.id)} className={`flex-1 text-sm cursor-pointer ${step.done ? "line-through text-muted-foreground" : ""}`}>{step.title}</span>
                </div>
              ))}
              {task.steps.length === 0 && <p className="text-[11px] text-muted-foreground py-1">No steps yet. Add steps from the Detail tab.</p>}
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

        {workspace && workspace.sessions.length > 0 && (
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-medium">Session history</h3>
              <div className="text-[11px] text-muted-foreground mt-0.5">{workspace.sessions.length} sessions &middot; {formatDuration(workspace.sessions.reduce((a, s) => a + s.duration, 0))} total</div>
            </div>
            <div className="p-3 space-y-2 max-h-[280px] overflow-y-auto">
              {[...workspace.sessions].reverse().map(s => (
                <div key={s.id} className="border border-border rounded-md p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-muted-foreground">{formatDate(s.date, "session")}</span>
                    <span className="font-mono text-xs font-medium">{formatDuration(s.duration)}</span>
                  </div>
                  {s.comment && <p className="text-[11px] text-foreground leading-relaxed">{s.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
