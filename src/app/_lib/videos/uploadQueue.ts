import type { VideoDTO } from "@/app/_lib/videos/dto";
import {
  type VideoUploadErrorCode,
  messageForCode,
} from "@/app/_lib/videos/errors";
import {
  type UploadProgress,
  UploadClientError,
  uploadVideoFile,
} from "@/app/_lib/videos/uploadClient";

/**
 * Framework-free, serial upload queue.
 *
 * One upload runs at a time (PRD: "single-file upload at a time per user").
 * Additional files wait as `queued` and start automatically. The module
 * singleton (`uploadQueue`) lives in module scope so it survives React route
 * navigation within a tab — the groundwork F11's persistent panel builds on.
 * The queue is decoupled from the transport so tests can inject a fake uploader.
 */

export type UploadItemStatus =
  | "queued"
  | "uploading"
  | "done"
  | "failed"
  | "cancelled";

export type UploadItem = {
  /** Client-generated id, stable from the moment the file is enqueued. */
  id: string;
  fileName: string;
  size: number;
  status: UploadItemStatus;
  loaded: number;
  total: number;
  error?: { code: VideoUploadErrorCode; message: string };
  video?: VideoDTO;
};

export type Uploader = (opts: {
  file: File;
  signal: AbortSignal;
  onProgress: (progress: UploadProgress) => void;
}) => Promise<VideoDTO>;

type Listener = () => void;

type QueueOptions = {
  /** Auto-remove a `done` card after this many ms; `0` disables it. */
  autoDismissMs?: number;
};

const DEFAULT_AUTO_DISMISS_MS = 5000;

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `up-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createUploadQueue(
  uploader: Uploader = ({ file, signal, onProgress }) =>
    uploadVideoFile({ file, signal, onProgress }),
  options: QueueOptions = {},
) {
  const autoDismissMs = options.autoDismissMs ?? DEFAULT_AUTO_DISMISS_MS;

  let items: UploadItem[] = [];
  const files = new Map<string, File>();
  const controllers = new Map<string, AbortController>();
  const listeners = new Set<Listener>();
  let activeId: string | null = null;

  function emit() {
    for (const listener of listeners) listener();
  }

  function patch(id: string, changes: Partial<UploadItem>) {
    let changed = false;
    items = items.map((item) => {
      if (item.id !== id) return item;
      changed = true;
      return { ...item, ...changes };
    });
    if (changed) emit();
  }

  function remove(id: string) {
    const before = items.length;
    items = items.filter((item) => item.id !== id);
    files.delete(id);
    controllers.delete(id);
    if (items.length !== before) emit();
  }

  function processNext() {
    if (activeId !== null) return;
    const next = items.find((item) => item.status === "queued");
    if (!next) return;

    const file = files.get(next.id);
    if (!file) {
      patch(next.id, { status: "failed", error: fail("UPL_DISK_WRITE") });
      processNext();
      return;
    }

    activeId = next.id;
    patch(next.id, { status: "uploading", loaded: 0, total: file.size });

    const controller = new AbortController();
    controllers.set(next.id, controller);

    uploader({
      file,
      signal: controller.signal,
      onProgress: ({ loaded, total }) => patch(next.id, { loaded, total }),
    })
      .then((video) => {
        patch(next.id, {
          status: "done",
          loaded: file.size,
          total: file.size,
          video,
        });
        scheduleDismiss(next.id);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") {
          patch(next.id, { status: "cancelled" });
        } else if (err instanceof UploadClientError) {
          patch(next.id, { status: "failed", error: fail(err.code) });
        } else {
          patch(next.id, { status: "failed", error: fail("UPL_DISK_WRITE") });
        }
      })
      .finally(() => {
        controllers.delete(next.id);
        activeId = null;
        processNext();
      });
  }

  function scheduleDismiss(id: string) {
    if (autoDismissMs <= 0) return;
    setTimeout(() => remove(id), autoDismissMs);
  }

  return {
    enqueue(newFiles: File[]): UploadItem[] {
      const added: UploadItem[] = [];
      for (const file of newFiles) {
        const id = createId();
        files.set(id, file);
        added.push({
          id,
          fileName: file.name,
          size: file.size,
          status: "queued",
          loaded: 0,
          total: file.size,
        });
      }
      if (added.length > 0) {
        items = [...items, ...added];
        emit();
        processNext();
      }
      return added;
    },

    cancel(id: string) {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      const controller = controllers.get(id);
      if (controller) {
        controller.abort();
      } else if (item.status === "queued") {
        patch(id, { status: "cancelled" });
      }
    },

    retry(id: string) {
      const item = items.find((i) => i.id === id);
      if (!item || !files.has(id)) return;
      if (item.status !== "failed" && item.status !== "cancelled") return;
      patch(id, { status: "queued", loaded: 0, error: undefined });
      processNext();
    },

    dismiss(id: string) {
      remove(id);
    },

    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getSnapshot(): readonly UploadItem[] {
      return items;
    },
  };
}

function fail(code: VideoUploadErrorCode) {
  return { code, message: messageForCode(code) };
}

export type UploadQueue = ReturnType<typeof createUploadQueue>;

/** Module singleton shared across all mounts of `useUploadQueue`. */
export const uploadQueue: UploadQueue = createUploadQueue();
