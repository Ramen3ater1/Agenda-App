import { useState } from "react";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Hammer,
  Check, Trash2,
} from "lucide-react";
import { uid } from "@/lib/utils";
import type { Task, Folder as FolderType } from "@/types";
import type { Priority, TaskStatus, RecurrenceType } from "@/types";

const STATUS_CFG: Record<TaskStatus, { label: string; cls: string }> = {
  "todo":        { label: "To Do",       cls: "bg-secondary text-muted-foreground" },
  "in-progress": { label: "In Progress", cls: "bg-accent/10 text-accent" },
  "done":        { label: "Done",        cls: "bg-emerald-500/10 text-emerald-600" },
};

export default function TaskDetailPanel({
  task, folders,
  onBack, onPrev, onNext, position, onOpenWorkspace,
  onUpdateTask, onToggleDone, onDeleteTask,
}: {
  task: Task;
  folders: FolderType[];
  onBack: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  position: string;
  onOpenWorkspace: () => void;
  onUpdateTask: (updates: Partial<Task>) => void;
  onToggleDone: () => void;
  onDeleteTask: () => void;
}) {
  const [newStep, setNewStep] = useState("");
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [stepTitle, setStepTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const done = task.status === "done";

  function addStep() { if (newStep.trim()) { onUpdateTask({ steps: [...task.steps, { id: uid(), title: newStep.trim(), done: false }] }); setNewStep(""); } }
  function saveStep(id: string) { if (stepTitle.trim()) onUpdateTask({ steps: task.steps.map(s => s.id === id ? { ...s, title: stepTitle.trim() } : s) }); setEditingStepId(null); }
  function toggleStep(id: string) { onUpdateTask({ steps: task.steps.map(s => s.id === id ? { ...s, done: !s.done } : s) }); }
  function removeStep(id: string) { onUpdateTask({ steps: task.steps.filter(s => s.id !== id) }); }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <div className="px-6 py-3 border-b border-border flex items-center justify-between shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={15} /> Back to list
        </button>
        <div className="flex items-center gap-1.5">
          <button onClick={onOpenWorkspace} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-foreground bg-secondary hover:bg-muted transition-colors mr-1"><Hammer size={14} /> Workspace</button>
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
              <div className="space-y-2">
                {task.steps.map(step => (
                  <div key={step.id} className="flex items-center gap-2.5 group border border-border rounded-md px-3 py-2 bg-background">
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
                <div className="flex items-center gap-2.5 border border-dashed border-border rounded-md px-3 py-2">
                  <div className="size-4 shrink-0 rounded border border-dashed border-border" />
                  <input value={newStep} onChange={e => setNewStep(e.target.value)} onKeyDown={e => e.key === "Enter" && addStep()} placeholder="Add a step…" className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/60" />
                  {newStep.trim() && <button onClick={addStep} className="text-xs text-accent hover:opacity-80">Add</button>}
                </div>
              </div>
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
                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${STATUS_CFG[task.status].cls}`}>
                  {STATUS_CFG[task.status].label}
                </span>
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
          </div>
        </div>
      </div>
    </div>
  );
}
