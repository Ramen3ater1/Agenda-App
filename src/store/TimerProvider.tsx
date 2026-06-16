import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useTaskStore } from "@/store/TaskProvider";
import { createWorkSession, todayISO } from "@/lib/utils";
import { loadTimer, saveTimer, type PersistedTimer } from "@/lib/storage";

interface TimerState {
  workspaceId: string | null;
  running: boolean;
  accumulated: number;
  startedAt: number | null;
}

function computeElapsed(s: TimerState): number {
  return s.accumulated + (s.running && s.startedAt ? Math.floor((Date.now() - s.startedAt) / 1000) : 0);
}

interface TimerApi {
  workspaceId: string | null;
  running: boolean;
  elapsed: number;
  start: (workspaceId: string) => void;
  pause: () => void;
  end: (workspaceId: string, comment: string) => void;
  reset: () => void;
}

const EMPTY: TimerState = { workspaceId: null, running: false, accumulated: 0, startedAt: null };
const TimerContext = createContext<TimerApi | null>(null);

export function TimerProvider({ children }: { children: ReactNode }) {
  const { dispatch } = useTaskStore();
  const [state, setState] = useState<TimerState>(() => (loadTimer() as TimerState | null) ?? EMPTY);
  const [, setTick] = useState(0);

  useEffect(() => {
    saveTimer(state as PersistedTimer);
  }, [state]);

  useEffect(() => {
    if (!state.running) return;
    const i = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(i);
  }, [state.running]);

  const elapsed = computeElapsed(state);

  function start(workspaceId: string) {
    if (state.workspaceId !== workspaceId) {
      const prevElapsed = computeElapsed(state);
      if (prevElapsed > 0 && state.workspaceId) {
        dispatch({ type: "ADD_SESSION", workspaceId: state.workspaceId, session: createWorkSession(todayISO(), prevElapsed, "Auto-saved on switch") });
      }
      setState({ workspaceId, running: true, accumulated: 0, startedAt: Date.now() });
    } else {
      setState(prev => ({ ...prev, running: true, startedAt: Date.now() }));
    }
  }

  function pause() {
    setState(prev => prev.running ? { ...prev, running: false, accumulated: computeElapsed(prev), startedAt: null } : prev);
  }

  function end(workspaceId: string, comment: string) {
    const e = computeElapsed(state);
    if (e > 0) {
      dispatch({ type: "ADD_SESSION", workspaceId, session: createWorkSession(todayISO(), e, comment) });
    }
    setState(EMPTY);
  }

  function reset() {
    setState(EMPTY);
  }

  return (
    <TimerContext.Provider value={{ workspaceId: state.workspaceId, running: state.running, elapsed, start, pause, end, reset }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer(): TimerApi {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be used within TimerProvider");
  return ctx;
}
