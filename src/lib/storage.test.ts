import { describe, it, expect, beforeEach } from "vitest";
import { loadState, saveState, loadTimer, saveTimer } from "@/lib/storage";
import type { PersistedState, PersistedTimer } from "@/lib/storage";

beforeEach(() => localStorage.clear());

const sample: PersistedState = {
  tasks: [], folders: [{ id: "f1", name: "X" }], workspaces: [], gcalConnected: true,
};

describe("state persistence", () => {
  it("returns null when nothing stored", () => {
    expect(loadState()).toBeNull();
  });
  it("round-trips saved state", () => {
    saveState(sample);
    expect(loadState()).toEqual(sample);
  });
  it("returns null on corrupt JSON", () => {
    localStorage.setItem("agenda:v1", "{not json");
    expect(loadState()).toBeNull();
  });
  it("returns null when shape is wrong", () => {
    localStorage.setItem("agenda:v1", JSON.stringify({ nope: true }));
    expect(loadState()).toBeNull();
  });
});

describe("timer persistence", () => {
  const timer: PersistedTimer = { workspaceId: "w1", running: true, accumulated: 30, startedAt: 1000 };
  it("returns null when nothing stored", () => {
    expect(loadTimer()).toBeNull();
  });
  it("round-trips timer", () => {
    saveTimer(timer);
    expect(loadTimer()).toEqual(timer);
  });
});
