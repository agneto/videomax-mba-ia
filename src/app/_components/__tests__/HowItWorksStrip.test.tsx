import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HowItWorksStrip } from "@/app/_components/HowItWorksStrip";

describe("HowItWorksStrip", () => {
  it("renders_three_steps_in_order", () => {
    render(<HowItWorksStrip />);
    const steps = screen.getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(steps.map((step) => step.querySelector("h3")?.textContent)).toEqual([
      "Upload",
      "Transcribe",
      "Summarize",
    ]);
  });
});
