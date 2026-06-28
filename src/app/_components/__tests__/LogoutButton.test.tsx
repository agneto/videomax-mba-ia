import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/_lib/auth/logout", () => ({
  logout: vi.fn(async () => {}),
}));

import { LogoutButton } from "@/app/_components/LogoutButton";
import { logout } from "@/app/_lib/auth/logout";

const logoutMock = vi.mocked(logout);

describe("LogoutButton", () => {
  afterEach(() => {
    logoutMock.mockClear();
  });

  it("renders_form_with_logout_action", () => {
    render(<LogoutButton />);
    expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();
  });

  it("form_posts_to_logout_server_action", async () => {
    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: /log out/i }));
    await vi.waitFor(() => expect(logoutMock).toHaveBeenCalled());
  });
});
