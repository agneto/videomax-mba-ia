import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const enqueue = vi.fn();
vi.mock("@/app/_components/upload/useUploadQueue", () => ({
  useUploadQueue: () => ({
    items: [],
    enqueue,
    cancel: vi.fn(),
    retry: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

import { UploadDropZone } from "@/app/_components/upload/UploadDropZone";
import { ACCEPT_ATTRIBUTE } from "@/app/_lib/videos/constants";

function makeFile(name: string, size: number): File {
  const file = new File(["x"], name, { type: "video/mp4" });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function dropFiles(files: File[]) {
  const zone = screen.getByRole("button", { name: /drag and drop/i });
  fireEvent.drop(zone, { dataTransfer: { files } });
}

afterEach(() => {
  enqueue.mockReset();
});

describe("UploadDropZone", () => {
  it("renders the upload button and drop area", () => {
    render(<UploadDropZone />);
    expect(
      screen.getByRole("button", { name: /upload video/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /drag and drop/i }),
    ).toBeInTheDocument();
  });

  it("enqueues a valid file on drop without a toast", () => {
    render(<UploadDropZone />);
    dropFiles([makeFile("clip.mp4", 1024)]);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0][0]).toHaveLength(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("rejects a bad extension with an inline toast", () => {
    render(<UploadDropZone />);
    dropFiles([makeFile("clip.mpg", 1024)]);
    expect(enqueue).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Only MP4, MOV, MKV, WEBM, and AVI files are supported",
    );
  });

  it("rejects an oversized file with an inline toast", () => {
    render(<UploadDropZone />);
    dropFiles([makeFile("clip.mp4", 3 * 1024 * 1024 * 1024)]);
    expect(enqueue).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Files must be at most 2GB",
    );
  });

  it("restricts the file picker to the allowed extensions", () => {
    const { container } = render(<UploadDropZone />);
    const input = container.querySelector('input[type="file"]');
    expect(input).toHaveAttribute("accept", ACCEPT_ATTRIBUTE);
  });
});
