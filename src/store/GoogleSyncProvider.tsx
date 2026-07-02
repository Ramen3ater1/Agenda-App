import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from "react";
import { toast } from "sonner";
import { useAuth } from "@/store/AuthProvider";
import { useTaskStore } from "@/store/TaskProvider";
import { toISO, type TimeWindow } from "@/lib/timeWindow";
import { listEvents, insertEvent, patchEvent, deleteEvent, GoogleAuthError } from "@/lib/googleCalendar";
import type { GCalEvent, Task } from "@/types";

const TOKEN_KEY = "agenda:gcal:token";     // { token, exp }
const PENDING_KEY = "agenda:gcal:pending"; // set while an OAuth redirect is in flight
const MAP_KEY = "agenda:gcal:eventmap";    // taskId -> Google eventId
const TOKEN_TTL_MS = 55 * 60 * 1000;       // provider tokens last ~1h; refresh a little early

function loadValidToken(): string | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const { token, exp } = JSON.parse(raw) as { token: string; exp: number };
    return exp > Date.now() ? token : null;
  } catch { return null; }
}
function saveToken(token: string) {
  try { localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, exp: Date.now() + TOKEN_TTL_MS })); } catch { /* ignore */ }
}
function loadMap(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(MAP_KEY) ?? "{}"); } catch { return {}; }
}

interface GoogleSyncValue {
  connected: boolean;
  needsReauth: boolean;
  syncing: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  setSyncing: (v: boolean) => void;
  token: string | null;
  onAuthError: () => void;
  upsertEvent: (task: Task) => Promise<void>;
  removeEvent: (taskId: string) => Promise<void>;
}

const Ctx = createContext<GoogleSyncValue | null>(null);

export function GoogleSyncProvider({ children }: { children: ReactNode }) {
  const { providerToken, connectGoogleCalendar } = useAuth();
  const { state, dispatch } = useTaskStore();
  const connected = state.gcalConnected;

  const [token, setToken] = useState<string | null>(() => loadValidToken());
  const [syncing, setSyncing] = useState(false);
  const mapRef = useRef<Record<string, string>>(loadMap());
  const persistMap = () => { try { localStorage.setItem(MAP_KEY, JSON.stringify(mapRef.current)); } catch { /* ignore */ } };

  // A fresh provider_token arrives right after the OAuth redirect. Persist it,
  // and if we kicked off the connect flow, flip gcalConnected on.
  useEffect(() => {
    if (!providerToken) return;
    saveToken(providerToken);
    setToken(providerToken);
    if (localStorage.getItem(PENDING_KEY)) {
      localStorage.removeItem(PENDING_KEY);
      dispatch({ type: "SET_GCAL", connected: true });
      toast.success("Google Calendar connected");
    }
  }, [providerToken, dispatch]);

  const onAuthError = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    toast.error("Google session expired — reconnect to keep syncing");
  }, []);

  const connect = useCallback(async () => {
    localStorage.setItem(PENDING_KEY, "1");
    const { error } = await connectGoogleCalendar();
    if (error) {
      localStorage.removeItem(PENDING_KEY);
      toast.error("Couldn't start Google sign-in");
    }
  }, [connectGoogleCalendar]);

  const disconnect = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    dispatch({ type: "SET_GCAL", connected: false });
    toast.success("Google Calendar disconnected");
  }, [dispatch]);

  const upsertEvent = useCallback(async (task: Task) => {
    if (!connected || !token) return;
    try {
      const existing = mapRef.current[task.id];
      if (existing) {
        await patchEvent(token, existing, task);
      } else {
        const id = await insertEvent(token, task);
        mapRef.current[task.id] = id;
        persistMap();
      }
    } catch (err) {
      if (err instanceof GoogleAuthError) onAuthError();
    }
  }, [connected, token, onAuthError]);

  const removeEvent = useCallback(async (taskId: string) => {
    const eventId = mapRef.current[taskId];
    if (!connected || !token || !eventId) return;
    try {
      await deleteEvent(token, eventId);
    } catch (err) {
      if (err instanceof GoogleAuthError) onAuthError();
    } finally {
      delete mapRef.current[taskId];
      persistMap();
    }
  }, [connected, token, onAuthError]);

  const value: GoogleSyncValue = {
    connected,
    needsReauth: connected && !token,
    syncing,
    connect,
    disconnect,
    setSyncing,
    token,
    onAuthError,
    upsertEvent,
    removeEvent,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGoogleSync(): GoogleSyncValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGoogleSync must be used within GoogleSyncProvider");
  return ctx;
}

// Pulls the connected user's Google Calendar events for the given window.
export function useGoogleEvents(window: TimeWindow): GCalEvent[] {
  const { connected, token, onAuthError, setSyncing } = useGoogleSync();
  const [events, setEvents] = useState<GCalEvent[]>([]);
  const startISO = toISO(window.start);
  const endISO = toISO(window.end);

  useEffect(() => {
    if (!connected || !token) {
      setEvents([]);
      // eslint-disable-next-line no-console
      if (connected && !token) console.warn("[gcal] connected but no access token (reconnect needed)");
      return;
    }
    let cancelled = false;
    setSyncing(true);
    listEvents(token, startISO, endISO)
      .then(evs => {
        if (cancelled) return;
        setEvents(evs);
        // eslint-disable-next-line no-console
        console.info(`[gcal] loaded ${evs.length} event(s) for ${startISO}..${endISO}`);
      })
      .catch(err => {
        if (err instanceof GoogleAuthError) { onAuthError(); return; }
        // eslint-disable-next-line no-console
        console.error("[gcal] failed to load events:", err);
        toast.error(`Calendar sync failed: ${err?.message ?? err}`);
      })
      .finally(() => { if (!cancelled) setSyncing(false); });
    return () => { cancelled = true; };
  }, [connected, token, startISO, endISO, onAuthError, setSyncing]);

  return connected ? events : [];
}
