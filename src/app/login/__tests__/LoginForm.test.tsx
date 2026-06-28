import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthFormState } from "@/app/_lib/validation";

const loginMock =
  vi.fn<(prev: AuthFormState, data: FormData) => Promise<AuthFormState>>();

vi.mock("@/app/_lib/auth/login", () => ({
  login: (prev: AuthFormState, data: FormData) => loginMock(prev, data),
}));

import { LoginForm } from "@/app/login/LoginForm";

describe("LoginForm", () => {
  afterEach(() => {
    loginMock.mockReset();
  });

  it("renders_email_and_password_fields", () => {
    loginMock.mockResolvedValue({ ok: false });
    render(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("renders_generic_error_at_top_of_form_when_action_returns_form_error", async () => {
    loginMock.mockResolvedValue({
      ok: false,
      errors: { _form: ["Invalid email or password"] },
    });
    render(<LoginForm />);

    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    expect(
      await screen.findByText("Invalid email or password"),
    ).toBeInTheDocument();
  });
});
