import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { getSession } from "@/app/_lib/session";
import { redirect } from "next/navigation";

vi.mock("@/app/_lib/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

const mockedGetSession = vi.mocked(getSession);
const mockedRedirect = vi.mocked(redirect);

describe("Home (landing page route)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("unauthenticated_visitor_sees_landing_sections", async () => {
    mockedGetSession.mockResolvedValue(null);

    render(await Home());

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /how it works/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("authenticated_visitor_is_redirected_to_app", async () => {
    mockedGetSession.mockResolvedValue({
      user: { id: "user-1", email: "ada@example.com", name: "Ada", isAdmin: false },
    });

    await Home();

    expect(mockedRedirect).toHaveBeenCalledTimes(1);
    expect(mockedRedirect).toHaveBeenCalledWith("/app");
  });

  it("page_loads_without_auth_requirement", async () => {
    mockedGetSession.mockResolvedValue(null);

    await Home();

    expect(mockedRedirect).not.toHaveBeenCalled();
  });
});
