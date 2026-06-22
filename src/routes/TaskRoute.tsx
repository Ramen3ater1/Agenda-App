import { useEffect } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import TaskDetailPanel from "@/features/task-detail";
import { useTasks } from "@/hooks/useTasks";
import { useFolders } from "@/hooks/useFolders";
import { selectListTasks } from "@/lib/utils";

export default function TaskRoute() {
  const navigate = useNavigate();
  const { taskId } = useParams();
  const [searchParams] = useSearchParams();
  const listKey = searchParams.get("list") ?? "all";

  const { tasks, updateTask, toggleDone, deleteTask } = useTasks();
  const { folders } = useFolders();

  const task = tasks.find(t => t.id === taskId);

  useEffect(() => {
    if (!task) toast.error("Task not found");
  }, [task]);

  if (!task) return <Navigate to="/today" replace />;

  const listIds = selectListTasks(tasks, listKey).map(t => t.id);
  const idx = listIds.indexOf(task.id);
  const backTo = listKey === "calendar" ? "/calendar"
    : listKey === "all" || listKey === "today" ? `/${listKey}`
    : `/folder/${listKey}`;

  function go(toId: string) {
    navigate(`/task/${toId}?list=${listKey}`);
  }

  return (
    <TaskDetailPanel
      task={task}
      folders={folders}
      onBack={() => navigate(backTo)}
      onPrev={idx > 0 ? () => go(listIds[idx - 1]) : undefined}
      onNext={idx >= 0 && idx < listIds.length - 1 ? () => go(listIds[idx + 1]) : undefined}
      position={idx >= 0 ? `${idx + 1} / ${listIds.length}` : ""}
      onOpenWorkspace={() => navigate(`/task/${task.id}/workspace?list=${listKey}`)}
      onUpdateTask={(updates) => updateTask(task.id, updates)}
      onToggleDone={() => toggleDone(task.id)}
      onDeleteTask={() => { deleteTask(task.id); navigate(backTo); }}
    />
  );
}
