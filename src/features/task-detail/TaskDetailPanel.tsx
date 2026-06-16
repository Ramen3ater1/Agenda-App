import { useState } from "react";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Play, Pause, Square,
  Plus, Check, Trash2, X, Link2, FileText, StickyNote,
} from "lucide-react";
import { formatDuration, formatDate, uid } from "@/lib/utils";
import type { Task, Workspace, Folder as FolderType, Resource, ResourceType } from "@/types";
import type { Priority, TaskStatus, RecurrenceType } from "@/types";

export default function TaskDetailPanel({
  task, workspace, folders,
  onBack, onPrev, onNext, position,
  onUpdateTask, onToggleDone, onDeleteTask,
  timerElapsed, timerRunning, timerWorkspaceId,
  onStartFocus, onPause, onRequestEnd, onUpdateWorkspace,
}: {
  task: Task;
  workspace?: Workspace;
  folders: FolderType[];
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
                  <div className="font-mono text-3xl font-medium tracking-tight leading-none">{formatDuration(effectiveElapsed)}</div>
                  <div className="text-xs text-muted-foreground mt-2 font-mono">Total logged: {formatDuration(totalTime)}</div>
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
    </div>
  );
}
