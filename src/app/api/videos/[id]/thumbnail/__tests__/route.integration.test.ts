import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import type { User } from "@prisma/client";
import { prisma } from "@/app/_lib/db";
import { GET } from "@/app/api/videos/[id]/thumbnail/route";
import { createSession } from "@/app/_lib/auth/session-store";
import { createUser, putSessionCookie } from "@tests/integration/helpers";

let root: string;
const originalRoot = process.env.VIDEO_STORAGE_ROOT;

function request(id: string): NextRequest {
  return new Request(
    `http://localhost/api/videos/${id}/thumbnail`,
  ) as unknown as NextRequest;
}

function call(id: string) {
  return GET(request(id), { params: Promise.resolve({ id }) });
}

async function authenticate(user: User) {
  const sessionId = await createSession(user.id);
  putSessionCookie(sessionId);
}

async function seedVideo(
  userId: string,
  thumbnailRelative: string | null,
): Promise<string> {
  const video = await prisma.video.create({
    data: {
      userId,
      title: "clip",
      originalFilename: "clip.mp4",
      sizeBytes: BigInt(100),
      containerFormat: "mp4",
      storagePath: path.join(userId, "vid", "source.mp4"),
      thumbnailPath: thumbnailRelative,
      status: "validating",
    },
  });
  if (thumbnailRelative) {
    const abs = path.join(root, thumbnailRelative);
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    await fsp.writeFile(abs, "jpeg-bytes");
  }
  return video.id;
}

beforeAll(async () => {
  root = await fsp.mkdtemp(path.join(os.tmpdir(), "vm-thumb-route-"));
  process.env.VIDEO_STORAGE_ROOT = root;
});

afterAll(async () => {
  if (originalRoot === undefined) delete process.env.VIDEO_STORAGE_ROOT;
  else process.env.VIDEO_STORAGE_ROOT = originalRoot;
  await fsp.rm(root, { recursive: true, force: true });
});

describe("GET /api/videos/[id]/thumbnail", () => {
  it("streams the thumbnail JPEG for the owner", async () => {
    const user = await createUser();
    await authenticate(user);
    const id = await seedVideo(
      user.id,
      path.join(user.id, id0(), "thumbnail.jpg"),
    );

    const res = await call(id);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(0);
  });

  it("sets a private cache-control header on success", async () => {
    const user = await createUser();
    await authenticate(user);
    const id = await seedVideo(
      user.id,
      path.join(user.id, id0(), "thumbnail.jpg"),
    );
    const res = await call(id);
    expect(res.headers.get("cache-control")).toBe("private, max-age=86400");
  });

  it("redirects to the placeholder when thumbnail_path is null", async () => {
    const user = await createUser();
    await authenticate(user);
    const id = await seedVideo(user.id, null);
    const res = await call(id);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("/placeholder-thumbnail.jpg");
  });

  it("returns 404 when the video belongs to another user", async () => {
    const owner = await createUser({ email: "owner@example.com" });
    const other = await createUser({ email: "other@example.com" });
    const id = await seedVideo(owner.id, null);
    await authenticate(other);
    const res = await call(id);
    expect(res.status).toBe(404);
  });

  it("returns 404 when the video does not exist", async () => {
    const user = await createUser();
    await authenticate(user);
    const res = await call("cnonexistentid000000000000");
    expect(res.status).toBe(404);
  });

  it("returns 404 when unauthenticated (no disclosure)", async () => {
    const user = await createUser();
    const id = await seedVideo(user.id, null);
    const res = await call(id);
    expect(res.status).toBe(404);
  });
});

// A stable per-video subdir segment for seeded thumbnails.
function id0(): string {
  return "vid";
}
