import { useState } from "react";
import {
  ArrowLeft, Play, Pause, Square,
  Plus, Check, X, Link2, FileText, StickyNote,
} from "lucide-react";
import { formatDuration, formatDate } from "@/lib/utils";
import { uid } from "@/lib/utils";
import type { Task, Workspace, Resource, ResourceType } from "@/types";

export default function WorkspacePanel({
  task, workspace,
  onBack,
  onUpdateTask,
  timerElapsed, timerRunning, timerWorkspaceId,
  onStartFocus, onPause, onRequestEnd, onUpdateWorkspace,
}: {
  task: Task;
  workspace?: Workspace;
  onBack: () => void;
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

  const isThisWorkspace = workspace != null && timerWorkspaceId === workspace.id;
  const isRunning = timerRunning && isThisWorkspace;
  const effectiveElapsed = isThisWorkspace ? timerElapsed : 0;

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
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <div className="px-6 py-3 border-b border-border flex items-center justify-between shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={15} /> Back to task
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[880px] mx-auto px-8 py-6 space-y-5">
          <h1 className="text-xl font-semibold px-1">{task.title}</h1>

          <div className="bg-card rounded-lg border border-border p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Focus session</div>
              {isRunning && <span className="flex items-center gap-1 text-[11px] text-emerald-600"><div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Recording</span>}
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="font-mono text-3xl font-medium tracking-tight leading-none">{formatDuration(effectiveElapsed)}</div>
                <div className="text-xs text-muted-foreground mt-2 font-mono">Total logged: {formatDuration((workspace?.sessions.reduce((a, s) => a + s.duration, 0) ?? 0) + effectiveElapsed)}</div>
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
                {task.steps.length === 0 && <p className="text-[11px] text-muted-foreground py-1">No steps yet. Add steps from the task page.</p>}
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
    </div>
  );
}
