import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";
import { prisma } from "@/app/_lib/db";
import { extractThumbnail, probeDuration } from "@/app/_lib/videos/probe";
import { moveToFinal } from "@/app/_lib/videos/storage";
import { uploadVideo } from "@/app/_lib/videos/upload";
import { createUser } from "@tests/integration/helpers";

// Probe/ffmpeg are stubbed here; a separate probe.integration test exercises the
// real binaries against a fixture.
vi.mock("@/app/_lib/videos/probe", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/app/_lib/videos/probe")>();
  return {
    ...actual,
    probeDuration: vi.fn(async () => null),
    extractThumbnail: vi.fn(async () => false),
  };
});

// moveToFinal defaults to the real implementation but can be forced to throw.
vi.mock("@/app/_lib/videos/storage", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/app/_lib/videos/storage")>();
  return { ...actual, moveToFinal: vi.fn(actual.moveToFinal) };
});

const probeDurationMock = probeDuration as unknown as Mock;
const extractThumbnailMock = extractThumbnail as unknown as Mock;
const moveToFinalMock = moveToFinal as unknown as Mock;

let root: string;
const originalRoot = process.env.VIDEO_STORAGE_ROOT;

function streamOf(size: number): Readable {
  return Readable.from([Buffer.alloc(size, 1)]);
}

beforeAll(async () => {
  root = await fsp.mkdtemp(path.join(os.tmpdir(), "vm-upload-"));
  process.env.VIDEO_STORAGE_ROOT = root;
});

afterAll(async () => {
  if (originalRoot === undefined) delete process.env.VIDEO_STORAGE_ROOT;
  else process.env.VIDEO_STORAGE_ROOT = originalRoot;
  await fsp.rm(root, { recursive: true, force: true });
});

beforeEach(() => {
  probeDurationMock.mockReset().mockResolvedValue(null);
  extractThumbnailMock.mockReset().mockResolvedValue(false);
  moveToFinalMock.mockReset();
});

describe("uploadVideo", () => {
  it("persists the row and file on the happy path", async () => {
    const user = await createUser();
    const dto = await uploadVideo({
      userId: user.id,
      requestStream: streamOf(2048),
      declaredName: "morning-standup.mp4",
      declaredSize: 2048,
    });

    expect(dto.status).toBe("validating");
    expect(dto.sizeBytes).toBe(2048);

    const row = await prisma.video.findUnique({ where: { id: dto.id } });
    expect(row?.status).toBe("validating");
    expect(row?.storagePath).toBe(
      path.join(user.id, dto.id, "source.mp4"),
    );
    const abs = path.join(root, user.id, dto.id, "source.mp4");
    expect(fs.statSync(abs).size).toBe(2048);
  });

  it("defaults the title to the filename without extension", async () => {
    const user = await createUser();
    const dto = await uploadVideo({
      userId: user.id,
      requestStream: streamOf(16),
      declaredName: "morning-standup.mp4",
      declaredSize: 16,
    });
    expect(dto.title).toBe("morning-standup");
  });

  it("truncates the title to 200 characters", async () => {
    const user = await createUser();
    // Kept ≤ 255 chars so it fits original_filename; the route rejects longer.
    const longName = `${"a".repeat(250)}.mp4`;
    const dto = await uploadVideo({
      userId: user.id,
      requestStream: streamOf(16),
      declaredName: longName,
      declaredSize: 16,
    });
    expect(dto.title.length).toBe(200);
  });

  it("rejects an oversized stream and leaves no row or file", async () => {
    const user = await createUser();
    process.env.VIDEO_MAX_BYTES = "10";
    try {
      await expect(
        uploadVideo({
          userId: user.id,
          requestStream: streamOf(50),
          declaredName: "big.mp4",
          declaredSize: 5,
        }),
      ).rejects.toMatchObject({ code: "UPL_TOO_LARGE" });
    } finally {
      delete process.env.VIDEO_MAX_BYTES;
    }
    expect(await prisma.video.count({ where: { userId: user.id } })).toBe(0);
  });

  it("rejects an unsupported extension", async () => {
    const user = await createUser();
    await expect(
      uploadVideo({
        userId: user.id,
        requestStream: streamOf(16),
        declaredName: "clip.mpg",
        declaredSize: 16,
      }),
    ).rejects.toMatchObject({ code: "UPL_BAD_EXTENSION" });
    expect(await prisma.video.count({ where: { userId: user.id } })).toBe(0);
  });

  it("stores the duration when the probe succeeds", async () => {
    probeDurationMock.mockResolvedValue(120.5);
    const user = await createUser();
    const dto = await uploadVideo({
      userId: user.id,
      requestStream: streamOf(16),
      declaredName: "clip.mp4",
      declaredSize: 16,
    });
    expect(dto.durationSeconds).toBe(120.5);
  });

  it("leaves the duration null when the probe fails", async () => {
    probeDurationMock.mockResolvedValue(null);
    const user = await createUser();
    const dto = await uploadVideo({
      userId: user.id,
      requestStream: streamOf(16),
      declaredName: "clip.mp4",
      declaredSize: 16,
    });
    expect(dto.durationSeconds).toBeNull();
  });

  it("sets the thumbnail path when extraction succeeds", async () => {
    extractThumbnailMock.mockImplementation(
      async ({ destination }: { destination: string }) => {
        await fsp.writeFile(destination, "jpeg");
        return true;
      },
    );
    const user = await createUser();
    const dto = await uploadVideo({
      userId: user.id,
      requestStream: streamOf(16),
      declaredName: "clip.mp4",
      declaredSize: 16,
    });
    expect(dto.hasCustomThumbnail).toBe(true);
    const abs = path.join(root, user.id, dto.id, "thumbnail.jpg");
    expect(fs.existsSync(abs)).toBe(true);
  });

  it("leaves the thumbnail null when extraction fails", async () => {
    extractThumbnailMock.mockResolvedValue(false);
    const user = await createUser();
    const dto = await uploadVideo({
      userId: user.id,
      requestStream: streamOf(16),
      declaredName: "clip.mp4",
      declaredSize: 16,
    });
    expect(dto.hasCustomThumbnail).toBe(false);
    const row = await prisma.video.findUnique({ where: { id: dto.id } });
    expect(row?.thumbnailPath).toBeNull();
  });

  it("rolls back the row when the post-insert disk move fails", async () => {
    moveToFinalMock.mockRejectedValueOnce(new Error("disk exploded"));
    const user = await createUser();
    await expect(
      uploadVideo({
        userId: user.id,
        requestStream: streamOf(16),
        declaredName: "clip.mp4",
        declaredSize: 16,
      }),
    ).rejects.toMatchObject({ code: "UPL_DISK_WRITE" });
    expect(await prisma.video.count({ where: { userId: user.id } })).toBe(0);
  });

  it("scopes files under each user's directory", async () => {
    const a = await createUser({ email: "a@example.com" });
    const b = await createUser({ email: "b@example.com" });
    const dtoA = await uploadVideo({
      userId: a.id,
      requestStream: streamOf(16),
      declaredName: "same.mp4",
      declaredSize: 16,
    });
    const dtoB = await uploadVideo({
      userId: b.id,
      requestStream: streamOf(16),
      declaredName: "same.mp4",
      declaredSize: 16,
    });
    expect(fs.existsSync(path.join(root, a.id, dtoA.id, "source.mp4"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(root, b.id, dtoB.id, "source.mp4"))).toBe(
      true,
    );
    expect(dtoA.id).not.toBe(dtoB.id);
  });
});
