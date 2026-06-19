import { useNavigate, useParams, useSearchParams } from "react-router";
import TaskListView from "@/features/task-list";
import { useTasks } from "@/hooks/useTasks";
import { useFolders } from "@/hooks/useFolders";
import { selectListTasks } from "@/lib/utils";

export default function ListRoute({ scope }: { scope: "today" | "all" | "folder" }) {
  const navigate = useNavigate();
  const { folderId } = useParams();
  const [, setSearchParams] = useSearchParams();
  const { tasks, addTask, toggleDone, updateTask } = useTasks();
  const { folders } = useFolders();

  const listKey = scope === "folder" ? (folderId ?? "") : scope;
  const listTasks = selectListTasks(tasks, listKey);
  const folder = scope === "folder" ? folders.find(f => f.id === folderId) : undefined;

  const title = scope === "today" ? "Today" : scope === "all" ? "All tasks" : (folder?.name ?? "Tasks");
  const subtitle = scope === "today" ? "Due today, overdue, or in progress"
    : scope === "all" ? "Every task across your lists"
    : folder ? "Tasks in this list" : "";

  return (
    <TaskListView
      title={title}
      subtitle={subtitle}
      tasks={listTasks}
      folders={folders}
      showFolderTag={scope === "all"}
      selectedTaskId={null}
      onSelectTask={(id) => navigate(`/task/${id}?list=${listKey}`)}
      onToggleDone={toggleDone}
      onToggleStep={(taskId, stepId) => {
        const t = tasks.find(x => x.id === taskId);
        if (!t) return;
        updateTask(taskId, { steps: t.steps.map(s => s.id === stepId ? { ...s, done: !s.done } : s) });
      }}
      onAddTask={(t) => addTask(t, { folderId: scope === "folder" ? folderId : undefined })}
      onAdvancedAdd={() => setSearchParams({ panel: "create" })}
      onShowOptimize={() => setSearchParams({ panel: "optimize" })}
      onShowAIPlan={() => setSearchParams({ panel: "plan" })}
    />
  );
}
