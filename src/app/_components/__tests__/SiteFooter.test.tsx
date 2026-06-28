import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "@/app/_components/SiteFooter";

describe("SiteFooter", () => {
  it("renders_semantic_footer_landmark", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("shows_current_year", () => {
    render(<SiteFooter />);
    const year = String(new Date().getFullYear());
    expect(
      screen.getByText(new RegExp(year)),
    ).toBeInTheDocument();
  });
});
