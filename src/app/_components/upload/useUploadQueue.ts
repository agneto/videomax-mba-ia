"use client";

import { useSyncExternalStore } from "react";
import {
  type UploadItem,
  uploadQueue,
} from "@/app/_lib/videos/uploadQueue";

const EMPTY: readonly UploadItem[] = [];

/**
 * React binding over the module-singleton `uploadQueue`. `useSyncExternalStore`
 * re-renders whenever the queue emits a new snapshot; the queue itself outlives
 * component mounts, so navigating between routes never drops an in-flight
 * upload. The server snapshot is a stable empty array (uploads are client-only).
 */
export function useUploadQueue() {
  const items = useSyncExternalStore(
    uploadQueue.subscribe,
    uploadQueue.getSnapshot,
    () => EMPTY,
  );

  return {
    items,
    enqueue: uploadQueue.enqueue,
    cancel: uploadQueue.cancel,
    retry: uploadQueue.retry,
    dismiss: uploadQueue.dismiss,
  };
}
