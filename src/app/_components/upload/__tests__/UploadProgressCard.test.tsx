import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UploadProgressCard } from "@/app/_components/upload/UploadProgressCard";
import type { UploadItem } from "@/app/_lib/videos/uploadQueue";

function baseItem(overrides: Partial<UploadItem>): UploadItem {
  return {
    id: "u1",
    fileName: "clip.mp4",
    size: 1000,
    status: "uploading",
    loaded: 450,
    total: 1000,
    ...overrides,
  };
}

function renderCard(item: UploadItem) {
  const handlers = {
    onCancel: vi.fn(),
    onRetry: vi.fn(),
    onDismiss: vi.fn(),
  };
  render(<UploadProgressCard item={item} {...handlers} />);
  return handlers;
}

describe("UploadProgressCard", () => {
  it("shows filename, percentage, and bytes while uploading", () => {
    renderCard(baseItem({ status: "uploading", loaded: 450, total: 1000 }));
    expect(screen.getByText("clip.mp4")).toBeInTheDocument();
    expect(screen.getByText("45%")).toBeInTheDocument();
    expect(screen.getByText(/450 B of 1000 B/)).toBeInTheDocument();
  });

  it("shows a cancel button while uploading", () => {
    const handlers = renderCard(baseItem({ status: "uploading" }));
    const cancel = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancel);
    expect(handlers.onCancel).toHaveBeenCalledWith("u1");
  });

  it("shows a retry button and error message on failure", () => {
    const handlers = renderCard(
      baseItem({
        status: "failed",
        error: { code: "UPL_INCOMPLETE", message: "Upload interrupted — retry" },
      }),
    );
    expect(screen.getByText("Upload interrupted — retry")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(handlers.onRetry).toHaveBeenCalledWith("u1");
  });

  it("shows the done state without cancel or retry", () => {
    renderCard(baseItem({ status: "done", loaded: 1000 }));
    expect(screen.getByText("clip.mp4")).toBeInTheDocument();
    expect(screen.getByText("Uploaded")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /cancel/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /retry/i }),
    ).not.toBeInTheDocument();
  });
});
