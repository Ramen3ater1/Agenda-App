import { useState } from "react";
import { Brain, Plus, ChevronRight, Check, Repeat, Folder, Wand2 } from "lucide-react";
import { PRIORITY_CFG, RECURRENCE_LABELS } from "@/constants";
import { daysLeft, formatDate } from "@/lib/utils";
import type { Task, Folder as FolderType } from "@/types";

export default function TaskListView({
  title, subtitle, tasks, folders, showFolderTag,
  selectedTaskId, onSelectTask, onToggleDone, onToggleStep, onAddTask, onAdvancedAdd,
  onShowOptimize, onShowAIPlan,
}: {
  title: string;
  subtitle: string;
  tasks: Task[];
  folders: FolderType[];
  showFolderTag: boolean;
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onToggleDone: (id: string) => void;
  onToggleStep: (taskId: string, stepId: string) => void;
  onAddTask: (title: string) => void;
  onAdvancedAdd: () => void;
  onShowOptimize: () => void;
  onShowAIPlan: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function submit() { if (draft.trim()) { onAddTask(draft.trim()); setDraft(""); } }
  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  const active = tasks.filter(t => t.status !== "done").length;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <div className="px-8 py-5 border-b border-border shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle} &middot; {active} active</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onShowAIPlan} className="flex items-center gap-2 px-3.5 py-2 border border-border text-sm font-medium rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
              <Brain size={14} className="text-accent" /> AI Plan
            </button>
            <button onClick={onShowOptimize} className="flex items-center gap-2 px-3.5 py-2 border border-border text-sm font-medium rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
              <Wand2 size={14} className="text-accent" /> AI Optimize
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-5">
        <div className="flex items-center gap-2.5 px-4 py-3 mb-3 bg-card border border-border rounded-lg">
          <button
            onClick={onAdvancedAdd}
            title="Advanced — full options"
            className="shrink-0 flex items-center justify-center size-7 rounded-md border border-border hover:bg-secondary hover:border-accent transition-colors"
          >
            <Plus size={16} strokeWidth={3} className="text-foreground" />
          </button>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="Add a task — press Enter"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {draft.trim() && <button onClick={submit} className="text-xs px-2.5 py-1 bg-foreground text-background rounded font-medium">Add</button>}
        </div>

        <div className="space-y-1.5">
          {tasks.map(task => {
            const cfg = PRIORITY_CFG[task.priority];
            const dl = daysLeft(task.deadline);
            const done = task.status === "done";
            const doneSteps = task.steps.filter(s => s.done).length;
            const pct = task.steps.length ? doneSteps / task.steps.length : 0;
            const folder = task.folderId ? folders.find(f => f.id === task.folderId) : undefined;
            const isSel = selectedTaskId === task.id;
            const isExpanded = expanded.has(task.id);
            return (
              <div
                key={task.id}
                className={`bg-card border rounded-lg overflow-hidden transition-colors ${isSel ? "border-accent" : "border-border"} ${done ? "opacity-60" : ""}`}
              >
                <div
                  onClick={() => onSelectTask(task.id)}
                  className="group flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/40 transition-colors"
                >
                  <div
                    onClick={e => { e.stopPropagation(); onToggleDone(task.id); }}
                    className={`shrink-0 size-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${done ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/30 hover:border-accent"}`}
                  >
                    {done && <Check size={11} className="text-white" strokeWidth={3} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium truncate ${done ? "line-through text-muted-foreground" : ""}`}>{task.title}</span>
                      {task.recurrence !== "none" && (
                        <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-secondary text-muted-foreground rounded shrink-0">
                          <Repeat size={8} /> {RECURRENCE_LABELS[task.recurrence]}
                        </span>
                      )}
                      {showFolderTag && folder && (
                        <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent rounded shrink-0">
                          <Folder size={8} /> {folder.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className={`flex items-center gap-1 text-xs ${cfg.color}`}>
                        <div className={`size-1.5 rounded-full ${cfg.dot}`} /> {cfg.label}
                      </span>
                      <span className={`text-xs ${dl <= 2 ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                        Due {formatDate(task.deadline, "short")}{dl <= 3 && dl >= 0 ? ` · ${dl}d left` : dl < 0 ? " · overdue" : ""}
                      </span>
                      {task.steps.length > 0 && <span className="text-xs text-muted-foreground font-mono">{doneSteps}/{task.steps.length}</span>}
                    </div>
                  </div>
                  {task.steps.length > 0 && (
                    <div className="w-14 shrink-0">
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct * 100}%` }} />
                      </div>
                    </div>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); toggleExpand(task.id); }}
                    aria-label={isExpanded ? "Collapse steps" : "Expand steps"}
                    className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronRight size={16} className={`transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                  </button>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-3 pt-2 border-t border-border space-y-1.5">
                    {task.steps.map(step => (
                      <div key={step.id} className="flex items-center gap-2.5">
                        <div
                          onClick={e => { e.stopPropagation(); onToggleStep(task.id, step.id); }}
                          className={`shrink-0 size-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${step.done ? "bg-accent border-accent" : "border-border hover:border-foreground/40"}`}
                        >
                          {step.done && <Check size={9} className="text-white" />}
                        </div>
                        <span className={`text-sm ${step.done ? "line-through text-muted-foreground" : ""}`}>{step.title}</span>
                      </div>
                    ))}
                    {task.steps.length === 0 && <p className="text-xs text-muted-foreground">No steps yet</p>}
                  </div>
                )}
              </div>
            );
          })}
          {tasks.length === 0 && (
            <div className="text-center py-16 text-sm text-muted-foreground">
              Nothing here yet. Add a task above to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
