import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { TaskProvider, useTaskStore } from "@/store/TaskProvider";
import { fetchAllData, syncAction } from "@/lib/db/sync";
import { migrateLocalToCloud } from "@/lib/db/migrate";
import { useAuth } from "@/store/AuthProvider";
import type { DataState } from "@/store/taskReducer";

vi.mock("@/store/AuthProvider", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/db/sync", () => ({ fetchAllData: vi.fn(), syncAction: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/db/migrate", () => ({ migrateLocalToCloud: vi.fn().mockResolvedValue(undefined) }));

function Probe() {
  const { state, dispatch } = useTaskStore();
  return (
    <div>
      <span data-testid="folders">{state.folders.map(f => f.name).join(",")}</span>
      <button onClick={() => dispatch({ type: "ADD_FOLDER", folder: { id: "fx", name: "New" } })}>add</button>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  (useAuth as Mock).mockReturnValue({ user: { id: "u1" } });
});

const cloud: DataState = { tasks: [], folders: [{ id: "f9", name: "Cloud" }], workspaces: [], gcalConnected: false };

describe("TaskProvider cloud integration", () => {
  it("loads cloud data and replaces local state", async () => {
    (fetchAllData as Mock).mockResolvedValue(cloud);
    render(<TaskProvider><Probe /></TaskProvider>);
    await waitFor(() => expect(screen.getByTestId("folders").textContent).toBe("Cloud"));
  });

  it("wrapped dispatch updates state and calls syncAction", async () => {
    (fetchAllData as Mock).mockResolvedValue(cloud);
    render(<TaskProvider><Probe /></TaskProvider>);
    await waitFor(() => expect(screen.getByTestId("folders").textContent).toBe("Cloud"));
    fireEvent.click(screen.getByRole("button", { name: "add" }));
    await waitFor(() => expect(screen.getByTestId("folders").textContent).toContain("New"));
    expect(syncAction).toHaveBeenCalled();
  });

  it("shows import prompt when cloud empty and localStorage non-empty", async () => {
    localStorage.setItem("agenda:v1", JSON.stringify({ tasks: [], folders: [{ id: "fl", name: "Local" }], workspaces: [], gcalConnected: false }));
    (fetchAllData as Mock).mockResolvedValue({ tasks: [], folders: [], workspaces: [], gcalConnected: false });
    render(<TaskProvider><Probe /></TaskProvider>);
    await waitFor(() => expect(screen.getByText("Import local data?")).toBeInTheDocument());
  });

  it("imports the real local snapshot, not the clobbered empty cache", async () => {
    localStorage.setItem("agenda:v1", JSON.stringify({ tasks: [], folders: [{ id: "fl", name: "Local" }], workspaces: [], gcalConnected: false }));
    (fetchAllData as Mock).mockResolvedValue({ tasks: [], folders: [], workspaces: [], gcalConnected: false });
    render(<TaskProvider><Probe /></TaskProvider>);
    await waitFor(() => expect(screen.getByText("Import local data?")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /import/i }));
    await waitFor(() => expect(migrateLocalToCloud).toHaveBeenCalled());
    const arg = (migrateLocalToCloud as Mock).mock.calls[0][0] as DataState;
    expect(arg.folders).toEqual([{ id: "fl", name: "Local" }]);
  });
});
