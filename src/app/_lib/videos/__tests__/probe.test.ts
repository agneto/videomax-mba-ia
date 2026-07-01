import { EventEmitter } from "node:events";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";
import {
  extractThumbnail,
  probeDuration,
  thumbnailSecondsFor,
} from "@/app/_lib/videos/probe";

vi.mock("node:child_process", () => {
  const spawnFn = vi.fn();
  return { spawn: spawnFn, default: { spawn: spawnFn } };
});

type FakeChild = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: Mock;
};

function makeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  return child;
}

const spawnMock = spawn as unknown as Mock;

beforeEach(() => {
  spawnMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("probeDuration", () => {
  it("parses the duration on a clean exit", async () => {
    const child = makeChild();
    spawnMock.mockReturnValue(child);
    const promise = probeDuration("clip.mp4");
    child.stdout.emit("data", Buffer.from("12.5\n"));
    child.emit("close", 0);
    await expect(promise).resolves.toBe(12.5);
  });

  it("returns null on a non-zero exit", async () => {
    const child = makeChild();
    spawnMock.mockReturnValue(child);
    const promise = probeDuration("clip.mp4");
    child.emit("close", 1);
    await expect(promise).resolves.toBeNull();
  });

  it("returns null when the process errors", async () => {
    const child = makeChild();
    spawnMock.mockReturnValue(child);
    const promise = probeDuration("clip.mp4");
    child.emit("error", new Error("ENOENT"));
    await expect(promise).resolves.toBeNull();
  });

  it("kills the process and returns null on timeout", async () => {
    vi.useFakeTimers();
    const child = makeChild();
    spawnMock.mockReturnValue(child);
    const promise = probeDuration("clip.mp4");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
    await expect(promise).resolves.toBeNull();
  });
});

describe("thumbnailSecondsFor", () => {
  it("uses ~10% of the duration", () => {
    expect(thumbnailSecondsFor(100)).toBe(10);
  });

  it("caps at 60 seconds", () => {
    expect(thumbnailSecondsFor(100_000)).toBe(60);
  });

  it("returns 0 for a null or sub-second duration", () => {
    expect(thumbnailSecondsFor(null)).toBe(0);
    expect(thumbnailSecondsFor(0.5)).toBe(0);
  });
});

describe("extractThumbnail", () => {
  it("returns true when ffmpeg exits 0 and writes a file", async () => {
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "vm-thumb-"));
    const destination = path.join(dir, "thumbnail.jpg");
    await fsp.writeFile(destination, "jpeg-bytes");

    const child = makeChild();
    spawnMock.mockReturnValue(child);
    const promise = extractThumbnail({
      source: "clip.mp4",
      destination,
      atSeconds: 1,
    });
    child.emit("close", 0);
    await expect(promise).resolves.toBe(true);
    await fsp.rm(dir, { recursive: true, force: true });
  });

  it("returns false on a non-zero exit", async () => {
    const child = makeChild();
    spawnMock.mockReturnValue(child);
    const promise = extractThumbnail({
      source: "clip.mp4",
      destination: "/tmp/does-not-matter.jpg",
      atSeconds: 1,
    });
    child.emit("close", 1);
    await expect(promise).resolves.toBe(false);
  });

  it("returns false when the file is missing after a clean exit", async () => {
    const child = makeChild();
    spawnMock.mockReturnValue(child);
    const promise = extractThumbnail({
      source: "clip.mp4",
      destination: path.join(os.tmpdir(), "vm-missing-thumb.jpg"),
      atSeconds: 1,
    });
    child.emit("close", 0);
    await expect(promise).resolves.toBe(false);
  });
});
