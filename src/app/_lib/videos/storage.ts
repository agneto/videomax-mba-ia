import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { VideoUploadError } from "@/app/_lib/videos/errors";

/**
 * Absolute path to the storage root. Relative `VIDEO_STORAGE_ROOT` values are
 * resolved against the project's cwd so both dev and tests behave predictably.
 * Lives here (not in the client-safe `constants.ts`) because it uses `node:path`.
 */
export function getStorageRoot(): string {
  const configured = process.env.VIDEO_STORAGE_ROOT ?? "storage/videos";
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(process.cwd(), configured);
}

/**
 * Filesystem layer for video uploads.
 *
 * Layout under VIDEO_STORAGE_ROOT:
 *   <root>/<userId>/<videoId>/source.<ext>
 *   <root>/<userId>/<videoId>/thumbnail.jpg
 *
 * Per-user directory makes "delete user" (F12) a single recursive remove;
 * per-video directory co-locates the source with its derived thumbnail. Only
 * paths RELATIVE to the root are persisted in the DB so the root can move
 * between machines without a data migration.
 */

const THUMBNAIL_FILENAME = "thumbnail.jpg";

export type VideoPaths = {
  /** Absolute path to `<root>/<userId>/<videoId>`. */
  videoDir: string;
  /** Absolute path to the source file. */
  source: string;
  /** Absolute path to the thumbnail file. */
  thumbnail: string;
  /** `<userId>/<videoId>/source.<ext>` — stored in `video.storage_path`. */
  sourceRelative: string;
  /** `<userId>/<videoId>/thumbnail.jpg` — stored in `video.thumbnail_path`. */
  thumbnailRelative: string;
};

/**
 * Reject any segment that could escape its parent directory. cuids never
 * contain these characters, so a value that does is either a bug or an attack.
 */
function assertSafeSegment(segment: string): void {
  if (
    segment.length === 0 ||
    segment.includes("/") ||
    segment.includes("\\") ||
    segment.includes("..") ||
    segment.includes("\0")
  ) {
    throw new VideoUploadError("UPL_PATH_TRAVERSAL");
  }
}

/** Resolve `relative` under the storage root and confirm it did not escape. */
export function resolveUnderRoot(relative: string): string {
  const root = getStorageRoot();
  const abs = path.resolve(root, relative);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (abs !== root && !abs.startsWith(rootWithSep)) {
    throw new VideoUploadError("UPL_PATH_TRAVERSAL");
  }
  return abs;
}

export function resolveVideoPaths(
  userId: string,
  videoId: string,
  ext: string,
): VideoPaths {
  assertSafeSegment(userId);
  assertSafeSegment(videoId);
  assertSafeSegment(ext);

  const sourceRelative = path.join(userId, videoId, `source.${ext}`);
  const thumbnailRelative = path.join(userId, videoId, THUMBNAIL_FILENAME);
  const source = resolveUnderRoot(sourceRelative);
  const thumbnail = resolveUnderRoot(thumbnailRelative);

  return {
    videoDir: path.dirname(source),
    source,
    thumbnail,
    sourceRelative,
    thumbnailRelative,
  };
}

/** Create `<root>/<userId>` (and the root) if missing; returns its abs path. */
export async function ensureUserDir(userId: string): Promise<string> {
  assertSafeSegment(userId);
  const dir = resolveUnderRoot(userId);
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Stream `source` into `tempPath`, aborting the moment the running byte count
 * exceeds `maxBytes`. Applies backpressure. On any failure the partial file is
 * removed before the error propagates. Returns the number of bytes written.
 */
export async function writeTempStream(
  tempPath: string,
  source: Readable,
  maxBytes: number,
): Promise<number> {
  await fsp.mkdir(path.dirname(tempPath), { recursive: true });
  const dest = fs.createWriteStream(tempPath);
  let bytesWritten = 0;

  try {
    await new Promise<void>((resolve, reject) => {
      const fail = (err: unknown) => {
        source.destroy();
        dest.destroy();
        reject(err);
      };

      source.on("data", (chunk: Buffer) => {
        bytesWritten += chunk.length;
        if (bytesWritten > maxBytes) {
          fail(new VideoUploadError("UPL_TOO_LARGE"));
          return;
        }
        if (!dest.write(chunk)) {
          source.pause();
          dest.once("drain", () => source.resume());
        }
      });
      source.on("end", () => dest.end());
      source.on("error", (err) => fail(err));
      dest.on("error", (err) => fail(err));
      dest.on("finish", () => resolve());
    });
    return bytesWritten;
  } catch (err) {
    await fsp.rm(tempPath, { force: true });
    throw err;
  }
}

/** Move a completed temp file to its final path, creating the dir as needed. */
export async function moveToFinal(
  tempPath: string,
  finalPath: string,
): Promise<void> {
  await fsp.mkdir(path.dirname(finalPath), { recursive: true });
  try {
    await fsp.rename(tempPath, finalPath);
  } catch (err) {
    // Cross-device rename (temp on a different mount): fall back to copy+remove.
    if ((err as NodeJS.ErrnoException).code === "EXDEV") {
      await fsp.copyFile(tempPath, finalPath);
      await fsp.rm(tempPath, { force: true });
      return;
    }
    throw err;
  }
}

/** Remove `<root>/<userId>/<videoId>` and everything in it. Idempotent. */
export async function removeVideoDir(
  userId: string,
  videoId: string,
): Promise<void> {
  assertSafeSegment(userId);
  assertSafeSegment(videoId);
  const dir = resolveUnderRoot(path.join(userId, videoId));
  await fsp.rm(dir, { recursive: true, force: true });
}

export type ThumbnailHandle = {
  size: number;
  stream: Readable;
};

/**
 * Open a thumbnail for streaming given its DB-relative path. Returns `null`
 * when the file is missing on disk (the caller then serves the placeholder).
 */
export async function readThumbnailStream(
  relativePath: string,
): Promise<ThumbnailHandle | null> {
  const abs = resolveUnderRoot(relativePath);
  try {
    const stat = await fsp.stat(abs);
    if (!stat.isFile()) return null;
    return { size: stat.size, stream: fs.createReadStream(abs) };
  } catch {
    return null;
  }
}
