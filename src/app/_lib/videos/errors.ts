/**
 * Typed upload errors.
 *
 * Every failure the upload path can produce carries a stable `code`. The Route
 * Handler maps the code to an HTTP status and a user-facing message; the client
 * transport maps the same codes back into typed rejections. Keeping the codes
 * in one union means the server and client never drift.
 */
export type VideoUploadErrorCode =
  | "UPL_UNAUTHORIZED"
  | "UPL_BAD_EXTENSION"
  | "UPL_BAD_MIME"
  | "UPL_MISSING_NAME"
  | "UPL_MISSING_SIZE"
  | "UPL_SIZE_MISMATCH"
  | "UPL_TOO_LARGE"
  | "UPL_INCOMPLETE"
  | "UPL_DISK_WRITE"
  | "UPL_PATH_TRAVERSAL";

const HTTP_STATUS_BY_CODE: Record<VideoUploadErrorCode, number> = {
  UPL_UNAUTHORIZED: 401,
  UPL_BAD_EXTENSION: 400,
  UPL_BAD_MIME: 400,
  UPL_MISSING_NAME: 400,
  UPL_MISSING_SIZE: 400,
  UPL_SIZE_MISMATCH: 400,
  UPL_TOO_LARGE: 413,
  UPL_INCOMPLETE: 400,
  UPL_DISK_WRITE: 500,
  UPL_PATH_TRAVERSAL: 400,
};

const MESSAGE_BY_CODE: Record<VideoUploadErrorCode, string> = {
  UPL_UNAUTHORIZED: "You must be signed in to upload videos",
  UPL_BAD_EXTENSION:
    "Only MP4, MOV, MKV, WEBM, and AVI files are supported",
  UPL_BAD_MIME: "Only MP4, MOV, MKV, WEBM, and AVI files are supported",
  UPL_MISSING_NAME: "Missing file name",
  UPL_MISSING_SIZE: "Missing or invalid file size",
  UPL_SIZE_MISMATCH: "Declared size does not match the uploaded body",
  UPL_TOO_LARGE: "Files must be at most 2GB",
  UPL_INCOMPLETE: "Upload interrupted — retry",
  UPL_DISK_WRITE: "Upload failed — please try again",
  UPL_PATH_TRAVERSAL: "Invalid file name",
};

export class VideoUploadError extends Error {
  readonly code: VideoUploadErrorCode;

  constructor(code: VideoUploadErrorCode, message?: string) {
    super(message ?? MESSAGE_BY_CODE[code]);
    this.name = "VideoUploadError";
    this.code = code;
  }

  get httpStatus(): number {
    return HTTP_STATUS_BY_CODE[this.code];
  }
}

export function httpStatusForCode(code: VideoUploadErrorCode): number {
  return HTTP_STATUS_BY_CODE[code];
}

export function messageForCode(code: VideoUploadErrorCode): string {
  return MESSAGE_BY_CODE[code];
}
