import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { VideoUploadError } from "@/app/_lib/videos/errors";
import {
  ensureUserDir,
  removeVideoDir,
  resolveVideoPaths,
  writeTempStream,
} from "@/app/_lib/videos/storage";

let root: string;
const originalRoot = process.env.VIDEO_STORAGE_ROOT;

beforeAll(async () => {
  root = await fsp.mkdtemp(path.join(os.tmpdir(), "vm-storage-"));
  process.env.VIDEO_STORAGE_ROOT = root;
});

afterAll(async () => {
  if (originalRoot === undefined) delete process.env.VIDEO_STORAGE_ROOT;
  else process.env.VIDEO_STORAGE_ROOT = originalRoot;
  await fsp.rm(root, { recursive: true, force: true });
});

describe("resolveVideoPaths", () => {
  it("returns per-user, per-video source and thumbnail paths", () => {
    const paths = resolveVideoPaths("u1", "v1", "mp4");
    expect(paths.source.endsWith(path.join("u1", "v1", "source.mp4"))).toBe(true);
    expect(
      paths.thumbnail.endsWith(path.join("u1", "v1", "thumbnail.jpg")),
    ).toBe(true);
    expect(paths.sourceRelative).toBe(path.join("u1", "v1", "source.mp4"));
    expect(paths.thumbnailRelative).toBe(path.join("u1", "v1", "thumbnail.jpg"));
  });

  it("rejects a traversal attempt in the user id", () => {
    expect(() => resolveVideoPaths("../etc", "v1", "mp4")).toThrow(
      VideoUploadError,
    );
    try {
      resolveVideoPaths("../etc", "v1", "mp4");
    } catch (err) {
      expect((err as VideoUploadError).code).toBe("UPL_PATH_TRAVERSAL");
    }
  });
});

describe("ensureUserDir", () => {
  it("creates the directory when missing", async () => {
    const dir = await ensureUserDir("new-user");
    expect(fs.existsSync(dir)).toBe(true);
  });
});

describe("writeTempStream", () => {
  it("aborts and cleans up when bytes exceed the limit", async () => {
    const tempPath = path.join(root, "over.part");
    const source = Readable.from([Buffer.alloc(1001)]);
    await expect(writeTempStream(tempPath, source, 1000)).rejects.toMatchObject({
      code: "UPL_TOO_LARGE",
    });
    expect(fs.existsSync(tempPath)).toBe(false);
  });

  it("writes the full body and returns the byte count when within limit", async () => {
    const tempPath = path.join(root, "ok.part");
    const source = Readable.from([Buffer.alloc(500), Buffer.alloc(300)]);
    const bytes = await writeTempStream(tempPath, source, 1000);
    expect(bytes).toBe(800);
    expect(fs.statSync(tempPath).size).toBe(800);
  });
});

describe("removeVideoDir", () => {
  it("deletes the video directory and its contents", async () => {
    const paths = resolveVideoPaths("owner", "vid", "mp4");
    await fsp.mkdir(paths.videoDir, { recursive: true });
    await fsp.writeFile(paths.source, "data");
    await fsp.writeFile(paths.thumbnail, "jpeg");

    await removeVideoDir("owner", "vid");
    expect(fs.existsSync(paths.videoDir)).toBe(false);
  });
});
