import type { Prisma, Video } from "@prisma/client";
import { prisma } from "@/app/_lib/db";
import { removeVideoDir } from "@/app/_lib/videos/storage";
import { INITIAL_VIDEO_STATUS, type VideoStatus } from "@/app/_lib/videos/status";
import { type VideoDTO, thumbnailUrlFor } from "@/app/_lib/videos/dto";

/**
 * Thin Prisma accessors for the `video` table. F03 owns this module; F04 and
 * F12 re-use these helpers so they never reach into Prisma directly.
 */

export type CreateVideoInput = {
  userId: string;
  title: string;
  originalFilename: string;
  sizeBytes: number;
  containerFormat: string;
  storagePath: string;
};

/**
 * Insert the initial row with `status = validating`. Optionally runs inside a
 * caller-provided transaction client so the row and the file move commit or
 * roll back together.
 */
export async function createVideoInitial(
  input: CreateVideoInput,
  tx: Prisma.TransactionClient = prisma,
): Promise<Video> {
  return tx.video.create({
    data: {
      userId: input.userId,
      title: input.title,
      originalFilename: input.originalFilename,
      sizeBytes: BigInt(input.sizeBytes),
      containerFormat: input.containerFormat,
      storagePath: input.storagePath,
      status: INITIAL_VIDEO_STATUS,
    },
  });
}

export async function setDuration(
  videoId: string,
  seconds: number | null,
): Promise<Video> {
  return prisma.video.update({
    where: { id: videoId },
    data: { durationSeconds: seconds },
  });
}

export async function setThumbnailPath(
  videoId: string,
  relativePath: string | null,
): Promise<Video> {
  return prisma.video.update({
    where: { id: videoId },
    data: { thumbnailPath: relativePath },
  });
}

export async function findVideoForUser(
  videoId: string,
  userId: string,
): Promise<Video | null> {
  return prisma.video.findFirst({ where: { id: videoId, userId } });
}

/**
 * Delete a video's DB row and its on-disk directory. Used by F04/F12 later;
 * exported here so F03 remains the module owner. The DB delete runs first so a
 * filesystem hiccup does not leave a dangling row.
 */
export async function deleteVideoCompletely(video: Video): Promise<void> {
  await prisma.video.delete({ where: { id: video.id } });
  await removeVideoDir(video.userId, video.id);
}

/** Serialize a Prisma row into the wire DTO (BigInt/Decimal → number). */
export function toVideoDTO(video: Video): VideoDTO {
  return {
    id: video.id,
    title: video.title,
    description: video.description,
    originalFilename: video.originalFilename,
    sizeBytes: Number(video.sizeBytes),
    durationSeconds:
      video.durationSeconds === null ? null : Number(video.durationSeconds),
    containerFormat: video.containerFormat,
    status: video.status as VideoStatus,
    thumbnailUrl: thumbnailUrlFor(video.id),
    hasCustomThumbnail: video.thumbnailPath !== null,
    createdAt: video.createdAt.toISOString(),
  };
}
