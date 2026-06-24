import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "@/store/AuthProvider";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

beforeEach(() => {
  vi.clearAllMocks();
  (supabase.auth.onAuthStateChange as Mock).mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
});

describe("AuthProvider", () => {
  it("starts loading, then exposes the restored user", async () => {
    (supabase.auth.getSession as Mock).mockResolvedValue({
      data: { session: { user: { id: "u1", email: "a@b.com" } } },
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user?.email).toBe("a@b.com");
  });

  it("has null user when no session", async () => {
    (supabase.auth.getSession as Mock).mockResolvedValue({ data: { session: null } });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it("forwards signIn to supabase", async () => {
    (supabase.auth.getSession as Mock).mockResolvedValue({ data: { session: null } });
    (supabase.auth.signInWithPassword as Mock).mockResolvedValue({ error: null });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.signIn("a@b.com", "secret123"); });
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "a@b.com", password: "secret123",
    });
  });

  it("updates user when onAuthStateChange fires", async () => {
    (supabase.auth.getSession as Mock).mockResolvedValue({ data: { session: null } });
    let cb: (e: string, s: unknown) => void = () => {};
    (supabase.auth.onAuthStateChange as Mock).mockImplementation((fn: typeof cb) => {
      cb = fn;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { cb("SIGNED_IN", { user: { id: "u2", email: "c@d.com" } }); });
    await waitFor(() => expect(result.current.user?.email).toBe("c@d.com"));
  });
});
