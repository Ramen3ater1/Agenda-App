import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import AuthGuard from "@/routes/AuthGuard";
import { useAuth } from "@/store/AuthProvider";

vi.mock("@/store/AuthProvider", () => ({ useAuth: vi.fn() }));

function renderAt() {
  return render(
    <MemoryRouter initialEntries={["/today"]}>
      <Routes>
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
        <Route element={<AuthGuard />}>
          <Route path="/today" element={<div>PROTECTED</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("AuthGuard", () => {
  it("shows splash while loading", () => {
    (useAuth as Mock).mockReturnValue({ user: null, loading: true });
    renderAt();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("redirects to /login when unauthenticated and not a guest", () => {
    (useAuth as Mock).mockReturnValue({ user: null, loading: false, isGuest: false });
    renderAt();
    expect(screen.getByText("LOGIN PAGE")).toBeInTheDocument();
  });

  it("renders the outlet for a guest", () => {
    (useAuth as Mock).mockReturnValue({ user: null, loading: false, isGuest: true });
    renderAt();
    expect(screen.getByText("PROTECTED")).toBeInTheDocument();
  });

  it("renders the outlet when authenticated", () => {
    (useAuth as Mock).mockReturnValue({ user: { id: "u1" }, loading: false });
    renderAt();
    expect(screen.getByText("PROTECTED")).toBeInTheDocument();
  });
});
