"use client";

import { useUploadQueue } from "@/app/_components/upload/useUploadQueue";
import { UploadProgressCard } from "@/app/_components/upload/UploadProgressCard";

/**
 * Renders one progress card per queued/active/finished upload. Reads straight
 * from the shared queue, so it reflects uploads started anywhere in the app.
 * Renders nothing when the queue is empty.
 */
export function UploadProgressList() {
  const { items, cancel, retry, dismiss } = useUploadQueue();

  if (items.length === 0) return null;

  return (
    <div
      className="flex flex-col gap-2"
      aria-label="Upload progress"
      data-testid="upload-progress-list"
    >
      {items.map((item) => (
        <UploadProgressCard
          key={item.id}
          item={item}
          onCancel={cancel}
          onRetry={retry}
          onDismiss={dismiss}
        />
      ))}
    </div>
  );
}
