import type { VideoDTO } from "@/app/_lib/videos/dto";
import {
  type VideoUploadErrorCode,
  messageForCode,
} from "@/app/_lib/videos/errors";

/**
 * Browser-side upload transport.
 *
 * Uses `XMLHttpRequest` (not `fetch`) because it is the only API that emits
 * real upload-progress events, which the PRD requires ("percentage and bytes
 * transferred"). Server error bodies (`{ code, message }`) are mapped back into
 * a typed `UploadClientError` so the UI can show the right copy and decide
 * whether a retry makes sense.
 */

export type UploadProgress = { loaded: number; total: number };

export type UploadClientOptions = {
  file: File;
  signal?: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
};

export class UploadClientError extends Error {
  readonly code: VideoUploadErrorCode;

  constructor(code: VideoUploadErrorCode, message?: string) {
    super(message ?? messageForCode(code));
    this.name = "UploadClientError";
    this.code = code;
  }
}

function parseErrorBody(
  body: unknown,
): { code: VideoUploadErrorCode; message?: string } | null {
  if (body && typeof body === "object" && "code" in body) {
    const record = body as { code?: unknown; message?: unknown };
    if (typeof record.code === "string") {
      return {
        code: record.code as VideoUploadErrorCode,
        message:
          typeof record.message === "string" ? record.message : undefined,
      };
    }
  }
  return null;
}

/** Read a JSON response whether `responseType` is `"json"` or plain text. */
function readJson(xhr: XMLHttpRequest): unknown {
  if (xhr.responseType === "json") return xhr.response;
  try {
    return JSON.parse(xhr.responseText);
  } catch {
    return null;
  }
}

export function uploadVideoFile(
  options: UploadClientOptions,
): Promise<VideoDTO> {
  const { file, signal, onProgress } = options;

  return new Promise<VideoDTO>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Upload aborted", "AbortError"));
      return;
    }

    const url = `/api/videos?name=${encodeURIComponent(file.name)}&size=${file.size}`;
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "json";
    xhr.setRequestHeader("Content-Type", "application/octet-stream");

    const onAbort = () => xhr.abort();
    signal?.addEventListener("abort", onAbort);
    const cleanup = () => signal?.removeEventListener("abort", onAbort);

    if (xhr.upload) {
      xhr.upload.onprogress = (event: ProgressEvent) => {
        if (event.lengthComputable) {
          onProgress?.({ loaded: event.loaded, total: event.total });
        }
      };
    }

    xhr.onload = () => {
      cleanup();
      if (xhr.status === 201) {
        resolve(readJson(xhr) as VideoDTO);
        return;
      }
      const parsed = parseErrorBody(readJson(xhr));
      if (parsed) {
        reject(new UploadClientError(parsed.code, parsed.message));
      } else {
        reject(new UploadClientError("UPL_DISK_WRITE"));
      }
    };

    xhr.onerror = () => {
      cleanup();
      reject(new UploadClientError("UPL_INCOMPLETE"));
    };

    xhr.onabort = () => {
      cleanup();
      reject(new DOMException("Upload aborted", "AbortError"));
    };

    xhr.send(file);
  });
}
