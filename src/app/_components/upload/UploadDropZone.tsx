"use client";

import { useRef, useState } from "react";
import { useUploadQueue } from "@/app/_components/upload/useUploadQueue";
import { ACCEPT_ATTRIBUTE } from "@/app/_lib/videos/constants";
import { validateClientFile } from "@/app/_lib/videos/clientValidation";
import { messageForCode } from "@/app/_lib/videos/errors";

const TOAST_TIMEOUT_MS = 5000;

/**
 * Drag-and-drop zone plus a file-picker fallback. Runs the same extension/size
 * check the server enforces, so bad files never start a transfer — they surface
 * an inline toast with the PRD copy instead. Valid files go straight into the
 * shared upload queue.
 */
export function UploadDropZone() {
  const { enqueue } = useUploadQueue();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_TIMEOUT_MS);
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const valid: File[] = [];
    let rejection: string | null = null;

    for (const file of Array.from(fileList)) {
      const result = validateClientFile(file);
      if (result.ok) {
        valid.push(file);
      } else if (!rejection) {
        rejection = messageForCode(result.reason);
      }
    }

    if (rejection) showToast(rejection);
    if (valid.length > 0) enqueue(valid);
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        aria-label="Drag and drop a video file here, or activate to choose one"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          isDragging
            ? "border-accent bg-accent/5"
            : "border-black/15 hover:border-black/30"
        }`}
      >
        <p className="text-sm font-medium text-foreground">
          Drag a video here to upload
        </p>
        <p className="text-xs text-muted">
          MP4, MOV, MKV, WEBM or AVI · up to 2GB
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
          className="mt-1 inline-flex items-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Upload video
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {toast && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {toast}
        </p>
      )}
    </div>
  );
}
