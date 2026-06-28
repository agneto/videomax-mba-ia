import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthFormState } from "@/app/_lib/validation";

const registerMock =
  vi.fn<(prev: AuthFormState, data: FormData) => Promise<AuthFormState>>();

vi.mock("@/app/_lib/auth/register", () => ({
  register: (prev: AuthFormState, data: FormData) => registerMock(prev, data),
}));

import { RegisterForm } from "@/app/register/RegisterForm";

describe("RegisterForm", () => {
  afterEach(() => {
    registerMock.mockReset();
  });

  it("renders_all_four_fields", () => {
    registerMock.mockResolvedValue({ ok: false });
    render(<RegisterForm />);
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it("renders_inline_error_under_password_when_action_returns_password_error", async () => {
    registerMock.mockResolvedValue({
      ok: false,
      errors: { password: ["Password must contain at least one number"] },
    });
    render(<RegisterForm />);

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByText("Password must contain at least one number"),
    ).toBeInTheDocument();
  });

  it("submit_button_uses_orange_accent", () => {
    registerMock.mockResolvedValue({ ok: false });
    render(<RegisterForm />);
    const button = screen.getByRole("button", { name: /create account/i });
    expect(button.className).toMatch(/bg-accent/);
  });
});
