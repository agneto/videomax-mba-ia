import { randomUUID } from "node:crypto";
import fsp from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { prisma } from "@/app/_lib/db";
import {
  extractExtension,
  getMaxVideoBytes,
  isAllowedExtension,
} from "@/app/_lib/videos/constants";
import { VideoUploadError } from "@/app/_lib/videos/errors";
import {
  extractThumbnail,
  probeDuration,
  thumbnailSecondsFor,
} from "@/app/_lib/videos/probe";
import {
  createVideoInitial,
  setDuration,
  setThumbnailPath,
  toVideoDTO,
} from "@/app/_lib/videos/repository";
import {
  ensureUserDir,
  moveToFinal,
  resolveUnderRoot,
  resolveVideoPaths,
  writeTempStream,
} from "@/app/_lib/videos/storage";
import type { VideoDTO } from "@/app/_lib/videos/dto";

/**
 * Server-side upload orchestration.
 *
 * Ties together validation, streaming-to-disk with a hard size guard, the row
 * insert (inside a transaction that also promotes the temp file to its final
 * path so both commit or roll back together), and the post-write, non-fatal
 * duration probe + thumbnail extraction. Every failure surfaces as a typed
 * `VideoUploadError`; the Route Handler maps the code to an HTTP status.
 */

export type UploadVideoInput = {
  userId: string;
  requestStream: Readable;
  declaredName: string;
  /** Bytes the client claims to send (from `?size=` / Content-Length). */
  declaredSize: number;
};

/** Filename without extension, trimmed and capped at 200 chars (F04 rename rule). */
export function deriveTitle(filename: string, ext: string): string {
  const withoutExt = filename.replace(new RegExp(`\\.${ext}$`, "i"), "");
  const trimmed = withoutExt.trim().slice(0, 200);
  return trimmed.length > 0 ? trimmed : "video";
}

export async function uploadVideo(input: UploadVideoInput): Promise<VideoDTO> {
  const { userId, requestStream, declaredName, declaredSize } = input;
  const maxBytes = getMaxVideoBytes();

  // 1. Pre-flight validation (defense-in-depth; the route validates too).
  if (!declaredName || declaredName.trim().length === 0) {
    throw new VideoUploadError("UPL_MISSING_NAME");
  }
  const ext = extractExtension(declaredName);
  if (!ext || !isAllowedExtension(ext)) {
    throw new VideoUploadError("UPL_BAD_EXTENSION");
  }
  if (!Number.isFinite(declaredSize) || declaredSize <= 0) {
    throw new VideoUploadError("UPL_MISSING_SIZE");
  }
  if (declaredSize > maxBytes) {
    throw new VideoUploadError("UPL_TOO_LARGE");
  }

  const title = deriveTitle(declaredName, ext);

  // 2. Stream the body into a temp file under the user's directory.
  await ensureUserDir(userId);
  const tempPath = path.join(
    resolveUnderRoot(userId),
    `.upload-${randomUUID()}.part`,
  );

  let bytesWritten: number;
  try {
    bytesWritten = await writeTempStream(tempPath, requestStream, maxBytes);
  } catch (err) {
    // writeTempStream already removed the partial file.
    if (err instanceof VideoUploadError) throw err; // UPL_TOO_LARGE
    // Any other stream error means the client went away mid-transfer.
    throw new VideoUploadError("UPL_INCOMPLETE");
  }

  // A short body (client disconnected before flushing everything) is incomplete.
  if (bytesWritten !== declaredSize) {
    await fsp.rm(tempPath, { force: true });
    throw new VideoUploadError("UPL_INCOMPLETE");
  }

  // 3. Insert the row and promote the temp file — atomically.
  let videoId: string;
  let sourcePath: string;
  let thumbnailPath: string;
  let thumbnailRelative: string;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const created = await createVideoInitial(
        {
          userId,
          title,
          originalFilename: declaredName,
          sizeBytes: bytesWritten,
          containerFormat: ext,
          storagePath: "",
        },
        tx,
      );
      const paths = resolveVideoPaths(userId, created.id, ext);
      await tx.video.update({
        where: { id: created.id },
        data: { storagePath: paths.sourceRelative },
      });
      await moveToFinal(tempPath, paths.source);
      return { id: created.id, paths };
    });
    videoId = result.id;
    sourcePath = result.paths.source;
    thumbnailPath = result.paths.thumbnail;
    thumbnailRelative = result.paths.thumbnailRelative;
  } catch (err) {
    await fsp.rm(tempPath, { force: true });
    if (err instanceof VideoUploadError) throw err;
    throw new VideoUploadError("UPL_DISK_WRITE");
  }

  // 4. Post-write, non-fatal: probe duration and extract a thumbnail. A failure
  //    here leaves duration/thumbnail null — F07 decides what to do with a bad
  //    file during its validate stage.
  const duration = await probeDuration(sourcePath);
  await setDuration(videoId, duration);

  const captured = await extractThumbnail({
    source: sourcePath,
    destination: thumbnailPath,
    atSeconds: thumbnailSecondsFor(duration),
  });
  if (captured) {
    await setThumbnailPath(videoId, thumbnailRelative);
  }

  const finalRow = await prisma.video.findUniqueOrThrow({
    where: { id: videoId },
  });
  return toVideoDTO(finalRow);
}
