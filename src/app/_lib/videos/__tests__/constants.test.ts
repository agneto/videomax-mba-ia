import { afterEach, describe, expect, it } from "vitest";
import {
  ACCEPT_ATTRIBUTE,
  ALLOWED_EXTENSIONS,
  extractExtension,
  getMaxVideoBytes,
  isAllowedExtension,
  isAllowedMime,
} from "@/app/_lib/videos/constants";

const originalMax = process.env.VIDEO_MAX_BYTES;

afterEach(() => {
  if (originalMax === undefined) delete process.env.VIDEO_MAX_BYTES;
  else process.env.VIDEO_MAX_BYTES = originalMax;
});

describe("upload constants", () => {
  it("lists the five accepted extensions", () => {
    expect(ALLOWED_EXTENSIONS).toEqual(["mp4", "mov", "mkv", "webm", "avi"]);
  });

  it("builds the accept attribute from the extensions", () => {
    expect(ACCEPT_ATTRIBUTE).toBe(".mp4,.mov,.mkv,.webm,.avi");
  });

  it("defaults MAX_VIDEO_BYTES to 2 GiB", () => {
    delete process.env.VIDEO_MAX_BYTES;
    expect(getMaxVideoBytes()).toBe(2 * 1024 * 1024 * 1024);
  });

  it("honours a valid VIDEO_MAX_BYTES override", () => {
    process.env.VIDEO_MAX_BYTES = "1000";
    expect(getMaxVideoBytes()).toBe(1000);
  });

  it("falls back to the default on an invalid override", () => {
    process.env.VIDEO_MAX_BYTES = "not-a-number";
    expect(getMaxVideoBytes()).toBe(2 * 1024 * 1024 * 1024);
    process.env.VIDEO_MAX_BYTES = "-5";
    expect(getMaxVideoBytes()).toBe(2 * 1024 * 1024 * 1024);
  });
});

describe("extractExtension", () => {
  it("returns the lowercased extension", () => {
    expect(extractExtension("clip.MP4")).toBe("mp4");
    expect(extractExtension("a.b.mkv")).toBe("mkv");
  });

  it("returns null for dotfiles, no extension, or trailing dot", () => {
    expect(extractExtension(".gitignore")).toBeNull();
    expect(extractExtension("noext")).toBeNull();
    expect(extractExtension("trailing.")).toBeNull();
  });
});

describe("isAllowedExtension / isAllowedMime", () => {
  it("accepts allowed extensions case-insensitively", () => {
    expect(isAllowedExtension("MOV")).toBe(true);
    expect(isAllowedExtension("mpg")).toBe(false);
  });

  it("accepts allowed MIME types and octet-stream, ignoring params", () => {
    expect(isAllowedMime("video/mp4")).toBe(true);
    expect(isAllowedMime("application/octet-stream")).toBe(true);
    expect(isAllowedMime("video/webm; codecs=vp9")).toBe(true);
    expect(isAllowedMime("image/png")).toBe(false);
  });
});
