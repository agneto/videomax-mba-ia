import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { getSession } from "@/app/_lib/session";
import { findVideoForUser } from "@/app/_lib/videos/repository";
import { readThumbnailStream } from "@/app/_lib/videos/storage";

// File streaming requires the Node runtime.
export const runtime = "nodejs";

const PLACEHOLDER_PATH = "/placeholder-thumbnail.jpg";

/** 404 for every not-authorized / not-found case — never disclose existence. */
function notFound(): Response {
  return Response.json({ code: "THUMB_NOT_FOUND" }, { status: 404 });
}

function placeholderRedirect(): Response {
  return new Response(null, {
    status: 307,
    headers: { Location: PLACEHOLDER_PATH },
  });
}

/**
 * `GET /api/videos/:id/thumbnail` — streams the owner's thumbnail JPEG, or
 * 307-redirects to the public placeholder when the row has no thumbnail. Any
 * unauthenticated / non-owner request gets a 404 (matches F12's disclosure
 * policy) rather than a 401/403.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return notFound();

  const { id } = await context.params;
  const video = await findVideoForUser(id, session.user.id);
  if (!video) return notFound();

  if (video.thumbnailPath === null) {
    return placeholderRedirect();
  }

  const handle = await readThumbnailStream(video.thumbnailPath);
  if (!handle) return notFound();

  const body = Readable.toWeb(
    handle.stream,
  ) as unknown as ReadableStream<Uint8Array>;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(handle.size),
      "Cache-Control": "private, max-age=86400",
    },
  });
}
