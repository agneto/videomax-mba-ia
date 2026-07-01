/**
 * Shared video-status vocabulary.
 *
 * F03 only ever writes `validating`, but the full set of pipeline stages is
 * declared here once so F04 (badges), F07 (pipeline transitions), F11
 * (notifications) and F12 (admin) import the same source of truth. The DB
 * stores this as a `VARCHAR(16)` with a CHECK constraint (see the migration)
 * rather than a native enum, so adding a value later is an application-level
 * change only.
 */
export const VIDEO_STATUSES = [
  "validating",
  "transcribing",
  "summarizing",
  "ready",
  "failed",
] as const;

export type VideoStatus = (typeof VIDEO_STATUSES)[number];

/** The status every freshly uploaded video starts in (F07 picks it up). */
export const INITIAL_VIDEO_STATUS: VideoStatus = "validating";

export function isVideoStatus(value: unknown): value is VideoStatus {
  return (
    typeof value === "string" &&
    (VIDEO_STATUSES as readonly string[]).includes(value)
  );
}
