import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteHeader } from "@/app/_components/SiteHeader";

describe("SiteHeader", () => {
  it("renders_product_wordmark", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByText("VideoMax MBA")).toBeInTheDocument();
  });

  it("login_link_points_to_login_route", () => {
    render(<SiteHeader />);
    const link = screen.getByRole("link", { name: /log in/i });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("login_link_has_visible_focus_ring", () => {
    render(<SiteHeader />);
    const link = screen.getByRole("link", { name: /log in/i });
    expect(link.className).toMatch(/focus-visible:/);
  });
});
