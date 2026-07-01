import { describe, expect, it } from "vitest";
import {
  INITIAL_VIDEO_STATUS,
  VIDEO_STATUSES,
  isVideoStatus,
} from "@/app/_lib/videos/status";

describe("video status", () => {
  it("exposes the five pipeline statuses in order", () => {
    expect(VIDEO_STATUSES).toEqual([
      "validating",
      "transcribing",
      "summarizing",
      "ready",
      "failed",
    ]);
  });

  it("starts every upload at validating", () => {
    expect(INITIAL_VIDEO_STATUS).toBe("validating");
  });

  it("accepts every known status", () => {
    for (const status of VIDEO_STATUSES) {
      expect(isVideoStatus(status)).toBe(true);
    }
  });

  it("rejects unknown or non-string values", () => {
    expect(isVideoStatus("uploading")).toBe(false);
    expect(isVideoStatus("")).toBe(false);
    expect(isVideoStatus(null)).toBe(false);
    expect(isVideoStatus(42)).toBe(false);
  });
});
