"use client";

import type { UploadItem } from "@/app/_lib/videos/uploadQueue";

/** Human-readable byte size (binary units) for the progress card. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value >= 10 || Number.isInteger(value) ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[unit]}`;
}

function percentage(item: UploadItem): number {
  if (item.status === "done") return 100;
  if (item.total <= 0) return 0;
  return Math.min(100, Math.round((item.loaded / item.total) * 100));
}

const STATUS_LABEL: Record<UploadItem["status"], string> = {
  queued: "Queued",
  uploading: "Uploading",
  done: "Uploaded",
  failed: "Failed",
  cancelled: "Cancelled",
};

export type UploadProgressCardProps = {
  item: UploadItem;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onDismiss: (id: string) => void;
};

/**
 * Presentational card for one upload. No data-fetching — every action is
 * delegated to the parent so the same card renders in the library and (later)
 * in F11's notification panel.
 */
export function UploadProgressCard({
  item,
  onCancel,
  onRetry,
  onDismiss,
}: UploadProgressCardProps) {
  const pct = percentage(item);
  const isActive = item.status === "uploading" || item.status === "queued";
  const isDone = item.status === "done";
  const isFailed = item.status === "failed";

  return (
    <div
      className="rounded-lg border border-black/10 bg-background p-3 shadow-sm"
      data-testid="upload-progress-card"
      data-status={item.status}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className="truncate text-sm font-medium text-foreground"
          title={item.fileName}
        >
          {item.fileName}
        </p>
        <span className="shrink-0 text-xs text-muted">
          {STATUS_LABEL[item.status]}
        </span>
      </div>

      {(isActive || isDone) && (
        <>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/10"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-accent transition-[width]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-muted">
            <span>
              {formatBytes(isDone ? item.size : item.loaded)} of{" "}
              {formatBytes(item.size)}
            </span>
            <span>{pct}%</span>
          </div>
        </>
      )}

      {isFailed && item.error && (
        <p className="mt-2 text-xs text-red-600">{item.error.message}</p>
      )}

      <div className="mt-2 flex justify-end gap-2">
        {item.status === "uploading" && (
          <button
            type="button"
            onClick={() => onCancel(item.id)}
            className="text-xs font-medium text-muted hover:text-foreground"
          >
            Cancel
          </button>
        )}
        {(isFailed || item.status === "cancelled") && (
          <button
            type="button"
            onClick={() => onRetry(item.id)}
            className="text-xs font-medium text-accent-hover hover:underline"
          >
            Retry
          </button>
        )}
        {(isDone || isFailed || item.status === "cancelled") && (
          <button
            type="button"
            onClick={() => onDismiss(item.id)}
            aria-label={`Dismiss ${item.fileName}`}
            className="text-xs font-medium text-muted hover:text-foreground"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
