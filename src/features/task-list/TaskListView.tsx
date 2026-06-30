import { useState } from "react";
import { Reorder, useDragControls } from "motion/react";
import { Brain, ChevronRight, Check, Repeat, Folder, Wand2, GripVertical } from "lucide-react";
import QuickAddBar from "@/features/planner/QuickAddBar";
import { PRIORITY_CFG, RECURRENCE_LABELS } from "@/constants";
import { daysLeft, dueLabel } from "@/lib/utils";
import type { TaskSection } from "@/lib/utils";
import type { Task, Folder as FolderType } from "@/types";

interface RowProps {
  task: Task;
  folders: FolderType[];
  showFolderTag: boolean;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (id: string) => void;
  onToggleDone: (id: string) => void;
  onToggleStep: (taskId: string, stepId: string) => void;
  onToggleExpand: (id: string) => void;
}

function TaskRow({
  task, folders, showFolderTag, isSelected, isExpanded,
  onSelect, onToggleDone, onToggleStep, onToggleExpand,
}: RowProps) {
  const controls = useDragControls();
  const cfg = PRIORITY_CFG[task.priority];
  const dl = daysLeft(task.deadline);
  const done = task.status === "done";
  const doneSteps = task.steps.filter(s => s.done).length;
  const pct = task.steps.length ? doneSteps / task.steps.length : 0;
  const folder = task.folderId ? folders.find(f => f.id === task.folderId) : undefined;

  return (
    <Reorder.Item
      value={task}
      as="div"
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.02, boxShadow: "0 12px 30px rgba(0,0,0,0.35)", zIndex: 20 }}
      className={`relative bg-card border rounded-lg overflow-hidden ${isSelected ? "border-accent" : "border-border"} ${done ? "opacity-60" : ""}`}
    >
      <div
        onClick={() => onSelect(task.id)}
        className="group flex items-center gap-2 px-3 py-3 pb-4 cursor-pointer hover:bg-secondary/40 transition-colors"
      >
        {/* Drag handle — appears on hover, reorders within the current list */}
        <div
          onPointerDown={e => { e.stopPropagation(); controls.start(e); }}
          onClick={e => e.stopPropagation()}
          title="Drag to reorder"
          style={{ touchAction: "none" }}
          className="shrink-0 -ml-1 flex items-center justify-center w-4 cursor-grab active:cursor-grabbing text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical size={15} />
        </div>

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
              {dueLabel(task.deadline)}
            </span>
            {task.steps.length > 0 && <span className="text-xs text-muted-foreground font-mono">{doneSteps}/{task.steps.length}</span>}
          </div>
        </div>
        {/* "Expand" label sits where the progress bar used to be */}
        <button
          onClick={e => { e.stopPropagation(); onToggleExpand(task.id); }}
          aria-label={isExpanded ? "Collapse steps" : "Expand steps"}
          className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded ? "Collapse" : "Expand"}
          <ChevronRight size={15} className={`transition-transform ${isExpanded ? "rotate-90" : ""}`} />
        </button>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-border space-y-1.5">
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

      {/* Progress bar — replaces the card's bottom edge, full width, thin */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
        <div className="h-full bg-accent transition-all" style={{ width: `${pct * 100}%` }} />
      </div>
    </Reorder.Item>
  );
}

export default function TaskListView({
  title, subtitle, tasks, sections, folders, showFolderTag,
  selectedTaskId, onSelectTask, onToggleDone, onToggleStep, onAddTask, onAdvancedAdd, onReorder,
  onShowOptimize, onShowAIPlan, embedded = false,
}: {
  title?: string;
  subtitle?: string;
  tasks: Task[];
  sections?: TaskSection[];
  folders: FolderType[];
  showFolderTag: boolean;
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onToggleDone: (id: string) => void;
  onToggleStep: (taskId: string, stepId: string) => void;
  onAddTask: (title: string) => void;
  onAdvancedAdd: () => void;
  onReorder: (ids: string[]) => void;
  onShowOptimize?: () => void;
  onShowAIPlan?: () => void;
  // When embedded, render only the scrollable body (no page header / no h-screen).
  // The planner supplies its own header in this mode.
  embedded?: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  const active = tasks.filter(t => t.status !== "done").length;

  const rowProps = (task: Task) => ({
    task,
    folders,
    showFolderTag,
    isSelected: selectedTaskId === task.id,
    isExpanded: expanded.has(task.id),
    onSelect: onSelectTask,
    onToggleDone,
    onToggleStep,
    onToggleExpand: toggleExpand,
  });

  // A reorderable group of task cards (one per list, or one per All-section).
  const group = (items: Task[], key?: string) => (
    <Reorder.Group
      key={key}
      as="div"
      axis="y"
      values={items}
      onReorder={(next: Task[]) => onReorder(next.map(t => t.id))}
      className="space-y-1.5"
    >
      {items.map(task => <TaskRow key={task.id} {...rowProps(task)} />)}
    </Reorder.Group>
  );

  const emptyState = (
    <div className="text-center py-16 text-sm text-muted-foreground">
      Nothing here yet. Add a task above to get started.
    </div>
  );

  const body = (
    <div className="flex-1 overflow-y-auto px-8 py-5">
        <QuickAddBar onAddTask={onAddTask} onAdvancedAdd={onAdvancedAdd} className="mb-3" />

        {sections ? (
          sections.length === 0 ? emptyState : (
            sections.map((section, i) => (
              <div key={section.key} className={i === 0 ? "" : "mt-6"}>
                <div className="flex items-center gap-2 px-1 pb-2">
                  <h2 className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{section.label}</h2>
                  <span className="text-[11px] font-mono text-muted-foreground/60">{section.tasks.length}</span>
                </div>
                {group(section.tasks, section.key)}
              </div>
            ))
          )
        ) : (
          tasks.length === 0 ? emptyState : group(tasks)
        )}
    </div>
  );

  if (embedded) return body;

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
      {body}
    </div>
  );
}
