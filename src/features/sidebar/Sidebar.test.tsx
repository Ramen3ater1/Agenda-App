import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import Sidebar from "@/features/sidebar/Sidebar";
import { useAuth } from "@/store/AuthProvider";

vi.mock("@/store/AuthProvider", () => ({ useAuth: vi.fn() }));

const props = {
  activeList: "today",
  onSelectList: vi.fn(),
  folders: [],
  tasks: [],
  onCreateFolder: vi.fn(),
  onRenameFolder: vi.fn(),
  onDeleteFolder: vi.fn(),
  timerRunning: false,
  timerDisplay: "00:00",
  timerTaskName: "",
};

function renderSidebar() {
  return render(
    <MemoryRouter>
      <Sidebar {...props} />
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("Sidebar account footer", () => {
  it("shows email and Sign out for a logged-in user", () => {
    (useAuth as Mock).mockReturnValue({ user: { email: "a@b.com" }, isGuest: false, signOut: vi.fn() });
    renderSidebar();
    expect(screen.getByText("a@b.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("shows a sign-up CTA for a guest", () => {
    (useAuth as Mock).mockReturnValue({ user: null, isGuest: true, signOut: vi.fn() });
    renderSidebar();
    const link = screen.getByRole("link", { name: /sign up to save/i });
    expect(link).toHaveAttribute("href", "/signup");
    expect(screen.queryByRole("button", { name: /sign out/i })).not.toBeInTheDocument();
  });
});
