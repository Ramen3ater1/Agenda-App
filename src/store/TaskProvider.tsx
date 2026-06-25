import {
  createContext, useContext, useEffect, useReducer, useRef, useState, useCallback,
  type ReactNode, type Dispatch,
} from "react";
import { toast } from "sonner";
import { taskReducer, initDataState, type DataState, type DataAction } from "@/store/taskReducer";
import { loadState, saveState } from "@/lib/storage";
import { useAuth } from "@/store/AuthProvider";
import { fetchAllData, syncAction } from "@/lib/db/sync";
import { migrateLocalToCloud } from "@/lib/db/migrate";
import ImportLocalDataPrompt from "@/features/auth/ImportLocalDataPrompt";

interface TaskStore {
  state: DataState;
  dispatch: Dispatch<DataAction>;
}

const EMPTY: DataState = { tasks: [], folders: [], workspaces: [], gcalConnected: false };
const TaskContext = createContext<TaskStore | null>(null);

function isEmptyState(s: DataState): boolean {
  return s.tasks.length === 0 && s.folders.length === 0 && s.workspaces.length === 0;
}

export function TaskProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, rawDispatch] = useReducer(taskReducer, undefined, initDataState); // cache-first
  const [showImport, setShowImport] = useState(false);

  // keep a ref so the wrapped dispatch can read current state without re-creating
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // keep a ref to the current user so dispatch can skip cloud sync for guests
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // snapshot local data before the write-through cache clobbers it with empty state
  const pendingImportRef = useRef<DataState | null>(null);

  // write-through local cache (offline read cache)
  useEffect(() => { saveState(state); }, [state]);

  // load cloud data on login
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const cloud = await fetchAllData();
        if (cancelled) return;
        if (!isEmptyState(cloud)) {
          rawDispatch({ type: "REPLACE_ALL", state: { ...cloud, gcalConnected: loadState()?.gcalConnected ?? false } });
        } else {
          const local = loadState();
          const localNonEmpty = !!local && !isEmptyState(local);
          const dismissed = localStorage.getItem(`agenda:import-dismissed:${user.id}`);
          rawDispatch({ type: "REPLACE_ALL", state: { ...EMPTY, gcalConnected: local?.gcalConnected ?? false } });
          if (localNonEmpty && !dismissed) {
            pendingImportRef.current = local as DataState;
            setShowImport(true);
          }
        }
      } catch {
        if (!cancelled) toast.error("Offline — showing cached data");
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const dispatch = useCallback<Dispatch<DataAction>>((action) => {
    const prev = stateRef.current;
    const next = taskReducer(prev, action);
    rawDispatch(action);
    // guest mode: persist locally only, no cloud sync
    if (!userRef.current) return;
    void syncAction(action, prev, next).catch(() => {
      toast.error("Save failed, retrying…");
      void syncAction(action, prev, next).catch(() => toast.error("Still not synced — check your connection"));
    });
  }, []);

  function onImport() {
    const local = pendingImportRef.current;
    setShowImport(false);
    if (!local) return;
    void migrateLocalToCloud(local)
      .then(() => fetchAllData())
      .then(cloud => rawDispatch({ type: "REPLACE_ALL", state: { ...cloud, gcalConnected: local.gcalConnected } }))
      .catch(() => toast.error("Import failed, please try again"));
  }

  function onDismiss() {
    if (user) localStorage.setItem(`agenda:import-dismissed:${user.id}`, "1");
    setShowImport(false);
  }

  return (
    <TaskContext.Provider value={{ state, dispatch }}>
      {children}
      {showImport && <ImportLocalDataPrompt onImport={onImport} onDismiss={onDismiss} />}
    </TaskContext.Provider>
  );
}

export function useTaskStore(): TaskStore {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error("useTaskStore must be used within TaskProvider");
  return ctx;
}
