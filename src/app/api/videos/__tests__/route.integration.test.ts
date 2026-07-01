import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
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
import { moveToFinal } from "@/app/_lib/videos/storage";
import { POST } from "@/app/api/videos/route";
import { createSession } from "@/app/_lib/auth/session-store";
import { createUser, putSessionCookie } from "@tests/integration/helpers";

vi.mock("@/app/_lib/videos/probe", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/app/_lib/videos/probe")>();
  return {
    ...actual,
    probeDuration: vi.fn(async () => null),
    extractThumbnail: vi.fn(async () => false),
  };
});

vi.mock("@/app/_lib/videos/storage", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/app/_lib/videos/storage")>();
  return { ...actual, moveToFinal: vi.fn(actual.moveToFinal) };
});

const moveToFinalMock = moveToFinal as unknown as Mock;

let root: string;
const originalRoot = process.env.VIDEO_STORAGE_ROOT;

const OCTET = { "content-type": "application/octet-stream" };

function buildRequest(options: {
  name?: string;
  size?: number;
  body?: BodyInit | null;
  headers?: Record<string, string>;
}): NextRequest {
  const params = new URLSearchParams();
  if (options.name !== undefined)
    params.set("name", options.name);
  if (options.size !== undefined) params.set("size", String(options.size));
  const url = `http://localhost/api/videos?${params.toString()}`;
  return new Request(url, {
    method: "POST",
    body: options.body ?? null,
    headers: options.headers ?? OCTET,
    // @ts-expect-error — duplex is required for streaming bodies in undici
    duplex: "half",
  }) as unknown as NextRequest;
}

function chunkStream(size: number): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(size));
      controller.close();
    },
  });
}

async function authenticate(email = "ada@example.com") {
  const user = await createUser({ email });
  const sessionId = await createSession(user.id);
  putSessionCookie(sessionId);
  return user;
}

beforeAll(async () => {
  root = await fsp.mkdtemp(path.join(os.tmpdir(), "vm-route-"));
  process.env.VIDEO_STORAGE_ROOT = root;
});

afterAll(async () => {
  if (originalRoot === undefined) delete process.env.VIDEO_STORAGE_ROOT;
  else process.env.VIDEO_STORAGE_ROOT = originalRoot;
  await fsp.rm(root, { recursive: true, force: true });
});

beforeEach(() => {
  moveToFinalMock.mockReset();
});

describe("POST /api/videos", () => {
  it("returns 201 with the video DTO on the happy path", async () => {
    const user = await authenticate();
    const res = await POST(
      buildRequest({ name: "clip.mp4", size: 100, body: new Uint8Array(100) }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      title: "clip",
      description: "",
      originalFilename: "clip.mp4",
      sizeBytes: 100,
      containerFormat: "mp4",
      status: "validating",
      thumbnailUrl: `/api/videos/${body.id}/thumbnail`,
    });
    const row = await prisma.video.findUnique({ where: { id: body.id } });
    expect(row?.userId).toBe(user.id);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      buildRequest({ name: "clip.mp4", size: 100, body: new Uint8Array(100) }),
    );
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UPL_UNAUTHORIZED");
    expect(await prisma.video.count()).toBe(0);
  });

  it("returns 400 UPL_MISSING_NAME when the name query is absent", async () => {
    await authenticate();
    const res = await POST(
      buildRequest({ size: 100, body: new Uint8Array(100) }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("UPL_MISSING_NAME");
  });

  it("returns 400 UPL_BAD_EXTENSION for a .mpg name", async () => {
    await authenticate();
    const res = await POST(
      buildRequest({ name: "video.mpg", size: 100, body: new Uint8Array(100) }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("UPL_BAD_EXTENSION");
  });

  it("returns 413 when the declared size exceeds the limit", async () => {
    await authenticate();
    const res = await POST(
      buildRequest({
        name: "clip.mp4",
        size: 2 * 1024 * 1024 * 1024 + 1,
        body: new Uint8Array(10),
      }),
    );
    expect(res.status).toBe(413);
    expect((await res.json()).code).toBe("UPL_TOO_LARGE");
  });

  it("returns 400 UPL_SIZE_MISMATCH when declared size and Content-Length differ", async () => {
    await authenticate();
    const res = await POST(
      buildRequest({
        name: "clip.mp4",
        size: 50,
        body: new Uint8Array(100),
        headers: { ...OCTET, "content-length": "100" },
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("UPL_SIZE_MISMATCH");
  });

  it("returns 413 when the actual bytes exceed the limit mid-stream", async () => {
    const user = await authenticate();
    process.env.VIDEO_MAX_BYTES = "20";
    try {
      const res = await POST(
        buildRequest({ name: "clip.mp4", size: 10, body: chunkStream(100) }),
      );
      expect(res.status).toBe(413);
      expect((await res.json()).code).toBe("UPL_TOO_LARGE");
    } finally {
      delete process.env.VIDEO_MAX_BYTES;
    }
    expect(await prisma.video.count({ where: { userId: user.id } })).toBe(0);
  });

  it("returns 400 UPL_INCOMPLETE when the client sends fewer bytes than declared", async () => {
    const user = await authenticate();
    const res = await POST(
      buildRequest({ name: "clip.mp4", size: 100, body: chunkStream(50) }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("UPL_INCOMPLETE");
    expect(await prisma.video.count({ where: { userId: user.id } })).toBe(0);
  });

  it("returns 500 UPL_DISK_WRITE when the filesystem throws", async () => {
    const user = await authenticate();
    moveToFinalMock.mockRejectedValueOnce(new Error("disk exploded"));
    const res = await POST(
      buildRequest({ name: "clip.mp4", size: 100, body: new Uint8Array(100) }),
    );
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("UPL_DISK_WRITE");
    expect(await prisma.video.count({ where: { userId: user.id } })).toBe(0);
  });

  it("makes the video queryable immediately after a 201", async () => {
    const user = await authenticate();
    const res = await POST(
      buildRequest({ name: "clip.mp4", size: 100, body: new Uint8Array(100) }),
    );
    expect(res.status).toBe(201);
    const rows = await prisma.video.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("validating");
  });
});
