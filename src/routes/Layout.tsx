import { useState } from "react";
import { Outlet, useNavigate, useSearchParams, useLocation } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Toaster } from "sonner";
import Sidebar from "@/features/sidebar";
import AIOptimizeModal from "@/features/ai-optimize";
import AIPlanPanel from "@/features/ai-plan";
import TaskCreateModal from "@/features/task-create";
import OnboardingOverlay from "@/features/onboarding";
import { useTasks } from "@/hooks/useTasks";
import { useFolders } from "@/hooks/useFolders";
import { useTimer } from "@/store/TimerProvider";
import { formatDuration } from "@/lib/utils";
import { useAuth } from "@/store/AuthProvider";

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { tasks, addTask, applyOptimization } = useTasks();
  const { folders, createFolder, renameFolder, deleteFolder } = useFolders();
  const timer = useTimer();
  const onboardKey = `ff_onboarded:${user?.id ?? "anon"}`;
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem(onboardKey));

  const panel = searchParams.get("panel");
  function closePanel() {
    const next = new URLSearchParams(searchParams);
    next.delete("panel");
    setSearchParams(next, { replace: true });
  }

  const path = location.pathname;
  const activeList = path.startsWith("/planner/") ? (path.split("/planner/")[1].split("/")[0] || "all") : "all";

  const timerTask = timer.workspaceId ? tasks.find(t => t.workspaceId === timer.workspaceId) : null;

  function dismissOnboarding() {
    try { localStorage.setItem(onboardKey, "1"); } catch { /* ignore */ }
    setShowOnboarding(false);
    navigate("/planner/all");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
      <Toaster position="bottom-right" />
      <Sidebar
        activeList={activeList}
        onSelectList={(id) => navigate(`/planner/${id}`)}
        folders={folders}
        tasks={tasks}
        onCreateFolder={(name) => { const id = createFolder(name); navigate(`/planner/${id}`); }}
        onRenameFolder={renameFolder}
        onDeleteFolder={(id) => { deleteFolder(id); if (activeList === id) navigate("/planner/all"); }}
        timerRunning={timer.running}
        timerDisplay={formatDuration(timer.elapsed)}
        timerTaskName={timerTask?.title ?? ""}
      />

      <main className="relative flex flex-1 overflow-hidden">
        <Outlet />

        <AnimatePresence>
          {panel === "plan" && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                className="absolute inset-0 z-30 bg-black/25" onClick={closePanel} />
              <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="absolute right-0 top-0 z-40 h-full w-[480px] border-l border-border bg-card shadow-2xl">
                <AIPlanPanel tasks={tasks} onClose={closePanel} />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>

      {panel === "optimize" && (
        <AIOptimizeModal tasks={tasks} onApply={applyOptimization} onClose={closePanel} />
      )}
      {panel === "create" && (
        <TaskCreateModal
          folders={folders}
          defaultFolderId={activeList !== "all" ? activeList : undefined}
          onCreate={(title, opts) => addTask(title, opts)}
          onClose={closePanel}
        />
      )}
      {showOnboarding && <OnboardingOverlay onDone={dismissOnboarding} />}
    </div>
  );
}
