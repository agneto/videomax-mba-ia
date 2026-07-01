import {
  extractExtension,
  getMaxVideoBytes,
  isAllowedExtension,
} from "@/app/_lib/videos/constants";
import type { VideoUploadErrorCode } from "@/app/_lib/videos/errors";

/**
 * Client-side pre-flight validation. Mirrors the server's extension and size
 * rules so obviously-invalid files are rejected before any bytes leave the
 * browser. The reason codes match the server's typed error codes so the toast
 * copy comes from a single source (`messageForCode`).
 */

export type ClientValidationResult =
  | { ok: true; extension: string }
  | { ok: false; reason: Extract<VideoUploadErrorCode, "UPL_BAD_EXTENSION" | "UPL_TOO_LARGE"> };

export function validateClientFile(file: File): ClientValidationResult {
  const ext = extractExtension(file.name);
  if (!ext || !isAllowedExtension(ext)) {
    return { ok: false, reason: "UPL_BAD_EXTENSION" };
  }
  // An empty file cannot be a real video; report it under the size rule (there
  // is no dedicated empty-file code in the shared error union).
  if (file.size <= 0 || file.size > getMaxVideoBytes()) {
    return { ok: false, reason: "UPL_TOO_LARGE" };
  }
  return { ok: true, extension: ext };
}
