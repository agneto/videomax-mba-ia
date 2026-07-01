import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { getSession } from "@/app/_lib/session";
import {
  extractExtension,
  getMaxVideoBytes,
  isAllowedExtension,
  isAllowedMime,
} from "@/app/_lib/videos/constants";
import {
  type VideoUploadErrorCode,
  VideoUploadError,
  httpStatusForCode,
  messageForCode,
} from "@/app/_lib/videos/errors";
import { uploadVideo } from "@/app/_lib/videos/upload";

// Filesystem + child_process require the Node runtime; Edge lacks both.
export const runtime = "nodejs";

function errorResponse(code: VideoUploadErrorCode, message?: string): Response {
  return Response.json(
    { code, message: message ?? messageForCode(code) },
    { status: httpStatusForCode(code) },
  );
}

/**
 * `POST /api/videos?name=<encoded>&size=<bytes>` — streaming upload.
 *
 * Runs pre-flight checks (auth, name/extension, size, MIME, Content-Length)
 * before touching disk, then hands the request body to the orchestrator, which
 * streams it to storage and inserts the `video` row with `status=validating`.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return errorResponse("UPL_UNAUTHORIZED");
  }

  const { searchParams } = new URL(request.url);

  const name = searchParams.get("name");
  if (!name || name.trim().length === 0 || name.length > 255) {
    return errorResponse("UPL_MISSING_NAME");
  }

  const ext = extractExtension(name);
  if (!ext || !isAllowedExtension(ext)) {
    return errorResponse("UPL_BAD_EXTENSION");
  }

  const sizeRaw = searchParams.get("size");
  const declaredSize = sizeRaw ? Number.parseInt(sizeRaw, 10) : NaN;
  if (!Number.isFinite(declaredSize) || declaredSize <= 0) {
    return errorResponse("UPL_MISSING_SIZE");
  }
  if (declaredSize > getMaxVideoBytes()) {
    return errorResponse("UPL_TOO_LARGE");
  }

  const contentType = request.headers.get("content-type");
  if (!contentType || !isAllowedMime(contentType)) {
    return errorResponse("UPL_BAD_MIME");
  }

  // When the client declares a Content-Length it must agree with ?size.
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const parsed = Number.parseInt(contentLength, 10);
    if (Number.isFinite(parsed) && parsed !== declaredSize) {
      return errorResponse("UPL_SIZE_MISMATCH");
    }
  }

  if (!request.body) {
    return errorResponse("UPL_INCOMPLETE");
  }

  try {
    const dto = await uploadVideo({
      userId: session.user.id,
      requestStream: Readable.fromWeb(
        request.body as import("node:stream/web").ReadableStream,
      ),
      declaredName: name,
      declaredSize,
    });
    return Response.json(dto, { status: 201 });
  } catch (err) {
    if (err instanceof VideoUploadError) {
      return errorResponse(err.code, err.message);
    }
    return errorResponse("UPL_DISK_WRITE");
  }
}
