/**
 * Shared upload constraints. Both the client pre-flight check
 * (`clientValidation.ts`) and the server pre-flight/streaming guards import
 * from here so the rules can never drift between the two enforcement points.
 *
 * This module is imported by client components, so it must stay free of
 * Node-only imports (the storage-root resolver lives in `storage.ts`).
 */

/** Accepted container extensions (lowercase, without the dot). */
export const ALLOWED_EXTENSIONS = [
  "mp4",
  "mov",
  "mkv",
  "webm",
  "avi",
] as const;

export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

/**
 * MIME types accepted in the file-picker `accept` attribute and validated
 * (advisorily) server-side. Browsers are unreliable about some of these
 * (notably AVI/MKV), so the extension check is the real gate.
 */
export const ALLOWED_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-matroska",
  "video/webm",
  "video/x-msvideo",
] as const;

/** Also accepted on the wire: the generic binary type the client sends. */
export const OCTET_STREAM_MIME = "application/octet-stream";

/** 2 GiB default; overridable via VIDEO_MAX_BYTES. */
const DEFAULT_MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;

export function getMaxVideoBytes(): number {
  const raw = process.env.VIDEO_MAX_BYTES;
  if (!raw) return DEFAULT_MAX_VIDEO_BYTES;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_VIDEO_BYTES;
  return parsed;
}

/**
 * Evaluated eagerly for the common case. Server code that needs to respect a
 * runtime override should call `getMaxVideoBytes()` instead of reading this.
 */
export const MAX_VIDEO_BYTES = getMaxVideoBytes();

/** `.mp4,.mov,.mkv,.webm,.avi` — drives the `<input accept>` attribute. */
export const ACCEPT_ATTRIBUTE = ALLOWED_EXTENSIONS.map(
  (ext) => `.${ext}`,
).join(",");

export function isAllowedExtension(ext: string): ext is AllowedExtension {
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext.toLowerCase());
}

export function isAllowedMime(mime: string): boolean {
  const normalized = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  return (
    normalized === OCTET_STREAM_MIME ||
    (ALLOWED_MIME_TYPES as readonly string[]).includes(normalized)
  );
}

/**
 * Extract the lowercased extension (without the dot) from a filename, or `null`
 * when the name has no extension, is a dotfile, or ends in a dot. Kept free of
 * `node:path` so this module stays client-safe.
 */
export function extractExtension(filename: string): string | null {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0 || dot === filename.length - 1) return null;
  const ext = filename.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]+$/.test(ext) ? ext : null;
}
