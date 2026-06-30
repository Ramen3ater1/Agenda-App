import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import TaskDetailPanel from "@/features/task-detail";
import WorkspacePanel from "@/features/task-workspace";
import EndSessionModal from "@/features/end-session";
import { useTasks } from "@/hooks/useTasks";
import { useFolders } from "@/hooks/useFolders";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useTimer } from "@/store/TimerProvider";
import { selectListTasks } from "@/lib/utils";

export default function TaskRoute() {
  const navigate = useNavigate();
  const { taskId } = useParams();
  const [searchParams] = useSearchParams();
  const listKey = searchParams.get("list") ?? "all";

  // Planner context the detail page was opened from, preserved across back +
  // prev/next so we always return to the same view/level/date.
  const plannerCtx = () => {
    const p = new URLSearchParams();
    for (const k of ["level", "view", "date"]) {
      const v = searchParams.get(k);
      if (v) p.set(k, v);
    }
    const q = p.toString();
    return q ? `&${q}` : "";
  };

  const { tasks, updateTask, toggleDone, deleteTask, startFocus, ensureWorkspace } = useTasks();
  const { folders } = useFolders();
  const { getWorkspace, updateWorkspace } = useWorkspaces();
  const timer = useTimer();
  const [endingWorkspaceId, setEndingWorkspaceId] = useState<string | null>(null);
  const [tab, setTab] = useState<"detail" | "workspace">("detail");

  const task = tasks.find(t => t.id === taskId);

  useEffect(() => {
    if (!task) toast.error("Task not found");
  }, [task]);

  useEffect(() => {
    if (tab === "workspace" && task && !task.workspaceId) ensureWorkspace(task);
  }, [tab, task?.id, task?.workspaceId]);

  if (!task) return <Navigate to="/planner/all" replace />;

  const workspace = getWorkspace(task.workspaceId);
  const listIds = selectListTasks(tasks, listKey).map(t => t.id);
  const idx = listIds.indexOf(task.id);
  const ctx = plannerCtx();
  const backTo = `/planner/${listKey}${ctx ? `?${ctx.slice(1)}` : ""}`;

  function go(toId: string) {
    navigate(`/task/${toId}?list=${listKey}${ctx}`);
  }

  const onPrev = idx > 0 ? () => go(listIds[idx - 1]) : undefined;
  const onNext = idx >= 0 && idx < listIds.length - 1 ? () => go(listIds[idx + 1]) : undefined;
  const position = idx >= 0 ? `${idx + 1} / ${listIds.length}` : "";

  const tabCls = (active: boolean) =>
    `px-3 py-1 rounded-md text-sm font-medium transition-colors ${active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <div className="px-6 py-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(backTo)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={15} /> Back
          </button>
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5">
            <button onClick={() => setTab("detail")} className={tabCls(tab === "detail")}>Detail</button>
            <button onClick={() => setTab("workspace")} className={tabCls(tab === "workspace")}>Workspace</button>
          </div>
        </div>
        {tab === "detail" && (
          <div className="flex items-center gap-1.5">
            {position && <span className="text-[11px] text-muted-foreground font-mono mr-1">{position}</span>}
            <button onClick={onPrev} disabled={!onPrev} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent transition-colors"><ChevronLeft size={16} /></button>
            <button onClick={onNext} disabled={!onNext} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent transition-colors"><ChevronRight size={16} /></button>
          </div>
        )}
      </div>

      {tab === "detail" ? (
        <TaskDetailPanel
          task={task}
          folders={folders}
          onUpdateTask={(updates) => updateTask(task.id, updates)}
          onToggleDone={() => toggleDone(task.id)}
          onDeleteTask={() => { deleteTask(task.id); navigate(backTo); }}
        />
      ) : (
        <WorkspacePanel
          task={task}
          workspace={workspace}
          onUpdateTask={(updates) => updateTask(task.id, updates)}
          timerElapsed={timer.elapsed}
          timerRunning={timer.running}
          timerWorkspaceId={timer.workspaceId}
          onStartFocus={() => startFocus(task)}
          onPause={timer.pause}
          onRequestEnd={(wsId) => setEndingWorkspaceId(wsId)}
          onUpdateWorkspace={updateWorkspace}
        />
      )}

      {endingWorkspaceId && (
        <EndSessionModal
          elapsed={timer.elapsed}
          onSave={(comment) => { timer.end(endingWorkspaceId, comment); setEndingWorkspaceId(null); }}
          onCancel={() => setEndingWorkspaceId(null)}
        />
      )}
    </div>
  );
}
