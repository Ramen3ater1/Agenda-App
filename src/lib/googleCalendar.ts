import { parseISO, toISO, addDaysISO, timeToMinutes } from "@/lib/timeWindow";
import type { GCalEvent, Task } from "@/types";

const BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Thrown on a 401 so callers can flip the UI into a "reconnect" state.
export class GoogleAuthError extends Error {
  constructor() { super("Google authorization expired"); this.name = "GoogleAuthError"; }
}

interface GoogleDate { date?: string; dateTime?: string }
interface GoogleEvent {
  id: string;
  summary?: string;
  location?: string;
  status?: string;
  start?: GoogleDate;
  end?: GoogleDate;
}

async function call(token: string, path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (res.status === 401) throw new GoogleAuthError();
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json())?.error?.message ?? ""; } catch { /* non-JSON body */ }
    throw new Error(`Google Calendar API ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  return res.status === 204 ? null : res.json();
}

// ── Reading ──────────────────────────────────────────────────────────────────

function to12h(hhmm: string): string {
  const m = timeToMinutes(hhmm);
  const h = Math.floor(m / 60), min = m % 60;
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(min).padStart(2, "0")} ${ampm}`;
}

function mapEvent(e: GoogleEvent): GCalEvent | null {
  const start = e.start;
  if (!start) return null;
  const title = e.summary?.trim() || "(no title)";
  if (start.date) {
    // all-day
    return { id: e.id, title, date: start.date, time: "All day", allDay: true, location: e.location };
  }
  if (start.dateTime) {
    const sd = new Date(start.dateTime);
    const date = toISO(sd);
    const startTime = `${String(sd.getHours()).padStart(2, "0")}:${String(sd.getMinutes()).padStart(2, "0")}`;
    let durationMin: number | undefined;
    if (e.end?.dateTime) durationMin = Math.max(0, Math.round((new Date(e.end.dateTime).getTime() - sd.getTime()) / 60000)) || undefined;
    return { id: e.id, title, date, time: to12h(startTime), startTime, durationMin, location: e.location };
  }
  return null;
}

// Fetch events whose start falls in [startISO, endISO) (local dates).
export async function listEvents(token: string, startISO: string, endISO: string): Promise<GCalEvent[]> {
  const timeMin = new Date(parseISO(startISO)).toISOString();
  const timeMax = new Date(parseISO(endISO)).toISOString();
  const url = `${BASE}?singleEvents=true&orderBy=startTime&maxResults=250&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`;
  const data = await call(token, url);
  const items: GoogleEvent[] = data?.items ?? [];
  return items
    .filter(e => e.status !== "cancelled")
    .map(mapEvent)
    .filter((e): e is GCalEvent => e !== null);
}

// ── Writing (task → event) ───────────────────────────────────────────────────

function eventBody(task: Task) {
  const startDate = task.startDate ?? task.deadline;
  const base = {
    summary: task.title,
    description: task.description || undefined,
    location: task.location || undefined,
  };
  if (task.startTime) {
    const startMin = timeToMinutes(task.startTime);
    const [y, m, d] = startDate.split("-").map(Number);
    const start = new Date(y, m - 1, d, Math.floor(startMin / 60), startMin % 60);
    const end = new Date(start.getTime() + (task.durationMin ?? 60) * 60000);
    return { ...base, start: { dateTime: start.toISOString(), timeZone: LOCAL_TZ }, end: { dateTime: end.toISOString(), timeZone: LOCAL_TZ } };
  }
  // all-day: Google's end.date is exclusive
  return { ...base, start: { date: startDate }, end: { date: addDaysISO(startDate, 1) } };
}

export async function insertEvent(token: string, task: Task): Promise<string> {
  const data = await call(token, BASE, { method: "POST", body: JSON.stringify(eventBody(task)) });
  return data.id as string;
}

export async function patchEvent(token: string, eventId: string, task: Task): Promise<void> {
  await call(token, `${BASE}/${encodeURIComponent(eventId)}`, { method: "PATCH", body: JSON.stringify(eventBody(task)) });
}

export async function deleteEvent(token: string, eventId: string): Promise<void> {
  await call(token, `${BASE}/${encodeURIComponent(eventId)}`, { method: "DELETE" });
}

// Exposed for tests.
export const __test = { mapEvent, eventBody, to12h };
