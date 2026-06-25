import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import AuthForm from "@/features/auth/AuthForm";
import { useAuth } from "@/store/AuthProvider";

vi.mock("@/store/AuthProvider", () => ({ useAuth: vi.fn() }));

const signIn = vi.fn();
const signUp = vi.fn();
const signInWithGoogle = vi.fn();
const continueAsGuest = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (useAuth as Mock).mockReturnValue({ signIn, signUp, signInWithGoogle, continueAsGuest });
});

function renderForm(mode: "login" | "signup") {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthForm mode={mode} />
    </MemoryRouter>,
  );
}

function fill(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
}

describe("AuthForm", () => {
  it("blocks invalid email without calling signIn", () => {
    renderForm("login");
    fill("not-an-email", "secret123");
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("blocks short password", () => {
    renderForm("login");
    fill("a@b.com", "123");
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(screen.getByText("Password should be at least 6 digits")).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("calls signIn with valid input", async () => {
    signIn.mockResolvedValue({ error: null });
    renderForm("login");
    fill("a@b.com", "secret123");
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith("a@b.com", "secret123"),
    );
  });

  it("renders server error from signIn", async () => {
    signIn.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    renderForm("login");
    fill("a@b.com", "secret123");
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() =>
      expect(screen.getByText("Invalid login credentials")).toBeInTheDocument(),
    );
  });

  it("calls signInWithGoogle when Google button clicked", async () => {
    signInWithGoogle.mockResolvedValue({ error: null });
    renderForm("login");
    fireEvent.click(screen.getByRole("button", { name: /google/i }));
    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalled());
  });

  it("enters guest mode when 'Continue as guest' is clicked", () => {
    renderForm("login");
    fireEvent.click(screen.getByRole("button", { name: /continue as guest/i }));
    expect(continueAsGuest).toHaveBeenCalled();
  });

  it("in signup mode calls signUp", async () => {
    signUp.mockResolvedValue({ error: null, session: { user: { id: "u1" } } });
    renderForm("signup");
    fill("a@b.com", "secret123");
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => expect(signUp).toHaveBeenCalledWith("a@b.com", "secret123"));
  });
});
