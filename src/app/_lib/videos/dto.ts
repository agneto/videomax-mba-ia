import type { VideoStatus } from "@/app/_lib/videos/status";

/**
 * Serialized video shape returned by `POST /api/videos` and consumed by the
 * client (and later by F04's library). Kept free of any server-only imports
 * (no Prisma) so client modules can import the type safely.
 */
export type VideoDTO = {
  id: string;
  title: string;
  description: string;
  originalFilename: string;
  sizeBytes: number;
  durationSeconds: number | null;
  containerFormat: string;
  status: VideoStatus;
  thumbnailUrl: string;
  hasCustomThumbnail: boolean;
  createdAt: string;
};

export function thumbnailUrlFor(videoId: string): string {
  return `/api/videos/${videoId}/thumbnail`;
}
