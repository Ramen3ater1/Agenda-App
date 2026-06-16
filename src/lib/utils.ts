import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { RecurrenceType } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export type DateFormat = "short" | "session";
export function formatDate(iso: string, fmt: DateFormat = "short"): string {
  const d = new Date(iso + "T00:00:00");
  if (fmt === "session") {
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function daysLeft(deadline: string): number {
  return Math.ceil((new Date(deadline + "T00:00:00").getTime() - today().getTime()) / 86400000);
}

export function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}

export function firstDayOfMonth(y: number, m: number) {
  return new Date(y, m, 1).getDay();
}

export function advanceDeadline(deadline: string, recurrence: RecurrenceType): string {
  const d = new Date(deadline + "T00:00:00");
  if (recurrence === "daily") d.setDate(d.getDate() + 1);
  else if (recurrence === "weekly") d.setDate(d.getDate() + 7);
  else if (recurrence === "monthly") d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}
