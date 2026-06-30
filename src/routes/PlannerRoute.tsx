import { useNavigate, useParams, useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import PlannerHeader from "@/features/planner/PlannerHeader";
import CalendarView from "@/features/planner/CalendarView";
import TimelineView from "@/features/planner/TimelineView";
import QuickAddBar from "@/features/planner/QuickAddBar";
import TaskListView from "@/features/task-list";
import { useTasks } from "@/hooks/useTasks";
import { useFolders } from "@/hooks/useFolders";
import { useTaskStore } from "@/store/TaskProvider";
import { GCAL_EVENTS } from "@/constants";
import { todayISO } from "@/lib/utils";
import { getWindow, shiftWindow, bucketByWindow, tasksInWindow } from "@/lib/timeWindow";
import type { PlannerLevel, PlannerView } from "@/types";

const LEVELS: PlannerLevel[] = ["day", "week", "month"];
const VIEWS: PlannerView[] = ["checklist", "calendar", "timeline"];

export default function PlannerRoute() {
  const navigate = useNavigate();
  const { where = "all" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { tasks, addTask, toggleDone, updateTask, reorderTasks } = useTasks();
  const { folders } = useFolders();
  const { state } = useTaskStore();

  const level = (LEVELS.includes(searchParams.get("level") as PlannerLevel) ? searchParams.get("level") : "week") as PlannerLevel;
  const view = (VIEWS.includes(searchParams.get("view") as PlannerView) ? searchParams.get("view") : "checklist") as PlannerView;
  const date = searchParams.get("date") || todayISO();
  const window = getWindow(level, date);

  function setParam(updates: Record<string, string>) {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(updates)) next.set(k, v);
    setSearchParams(next, { replace: true });
  }
  function openPanel(name: string) { setParam({ panel: name }); }

  const whereTasks = where === "all" ? tasks : tasks.filter(t => t.folderId === where);
  const folder = where !== "all" ? folders.find(f => f.id === where) : undefined;
  const title = where === "all" ? "All tasks" : (folder?.name ?? "Tasks");
  const inWindow = tasksInWindow(whereTasks, window).length;
  const subtitle = `${inWindow} ${inWindow === 1 ? "task" : "tasks"} this ${level}`;

  const selectTask = (id: string) => navigate(`/task/${id}?list=${where}`);
  const quickAdd = (t: string) => addTask(t, { folderId: where !== "all" ? where : undefined });
  // Empty click/drag in calendar/timeline opens the same modal the "+" button does,
  // pre-filled with the picked date/time/duration (threaded via URL params).
  const onCreateAt = (date: string, startTime?: string, durationMin?: number) =>
    setParam({
      panel: "create",
      cdate: date,
      cstart: startTime ?? "",
      cdur: durationMin != null ? String(durationMin) : "",
    });

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <PlannerHeader
        title={title}
        subtitle={subtitle}
        window={window}
        level={level}
        view={view}
        onLevel={(l) => setParam({ level: l })}
        onView={(v) => setParam({ view: v })}
        onPrev={() => setParam({ date: shiftWindow(level, date, -1) })}
        onNext={() => setParam({ date: shiftWindow(level, date, 1) })}
        onToday={() => setParam({ date: todayISO() })}
        onShowAIPlan={() => openPanel("plan")}
        onShowOptimize={() => openPanel("optimize")}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={`${view}-${level}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="flex-1 flex flex-col overflow-hidden min-h-0"
        >
          {view !== "checklist" && (
            <div className="px-8 pt-4 shrink-0">
              <QuickAddBar onAddTask={quickAdd} onAdvancedAdd={() => openPanel("create")} />
            </div>
          )}

          {view === "checklist" && (
            <TaskListView
              embedded
              tasks={whereTasks}
              sections={bucketByWindow(whereTasks, window)}
              folders={folders}
              showFolderTag={where === "all"}
              selectedTaskId={null}
              onSelectTask={selectTask}
              onToggleDone={toggleDone}
              onToggleStep={(taskId, stepId) => {
                const t = tasks.find(x => x.id === taskId);
                if (t) updateTask(taskId, { steps: t.steps.map(s => s.id === stepId ? { ...s, done: !s.done } : s) });
              }}
              onReorder={reorderTasks}
              onAddTask={quickAdd}
              onAdvancedAdd={() => openPanel("create")}
            />
          )}

          {view === "calendar" && (
            <CalendarView
              tasks={whereTasks}
              window={window}
              gcalEvents={GCAL_EVENTS}
              gcalConnected={state.gcalConnected}
              onSelectTask={selectTask}
              onCreateAt={onCreateAt}
              onReschedule={(id, startDate, startTime) => updateTask(id, { startDate, startTime })}
              onResize={(id, durationMin) => updateTask(id, { durationMin })}
            />
          )}

          {view === "timeline" && (
            <TimelineView
              tasks={whereTasks}
              window={window}
              onSelectTask={selectTask}
              onUpdateTask={updateTask}
              onCreateAt={onCreateAt}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
