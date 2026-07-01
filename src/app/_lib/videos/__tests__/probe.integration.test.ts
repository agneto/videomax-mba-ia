import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  extractThumbnail,
  probeDuration,
  thumbnailSecondsFor,
} from "@/app/_lib/videos/probe";

// Exercises the real bundled ffprobe/ffmpeg binaries against a committed
// 2-second fixture, so the happy path is covered end-to-end without stubs.
const FIXTURE = path.resolve(process.cwd(), "tests/fixtures/tiny.mp4");

let dir: string;

beforeAll(async () => {
  dir = await fsp.mkdtemp(path.join(os.tmpdir(), "vm-probe-int-"));
});

afterAll(async () => {
  await fsp.rm(dir, { recursive: true, force: true });
});

describe("probe (real binaries)", () => {
  it("reports the fixture duration", async () => {
    const seconds = await probeDuration(FIXTURE);
    expect(seconds).not.toBeNull();
    expect(seconds).toBeGreaterThan(1.5);
    expect(seconds).toBeLessThan(2.5);
  });

  it("extracts a JPEG thumbnail", async () => {
    const destination = path.join(dir, "thumbnail.jpg");
    const ok = await extractThumbnail({
      source: FIXTURE,
      destination,
      atSeconds: thumbnailSecondsFor(2),
    });
    expect(ok).toBe(true);
    expect(fs.statSync(destination).size).toBeGreaterThan(0);
  });
});
