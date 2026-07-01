import { spawn } from "node:child_process";
import fsp from "node:fs/promises";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

/**
 * Thin wrappers around the bundled `ffprobe` / `ffmpeg` binaries.
 *
 * Both functions deliberately NEVER throw: a probe failure returns `null` and a
 * thumbnail failure returns `false`, so the upload orchestrator can record what
 * it has and let F07's validate stage make the final call on a bad file (per
 * the PRD, "Invalid or unreadable file" is an F07 concern, not F03's).
 */

const PROBE_TIMEOUT_MS = 30_000;
const THUMBNAIL_TIMEOUT_MS = 60_000;

/** Cap the seek point so a pathological duration doesn't seek deep. */
const MAX_THUMBNAIL_SECONDS = 60;

type SpawnResult = { code: number | null; stdout: string; stderr: string };

function runProcess(
  command: string,
  args: string[],
  timeoutMs: number,
): Promise<SpawnResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });

    const finish = (result: SpawnResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ code: null, stdout, stderr });
    }, timeoutMs);

    child.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", () => finish({ code: null, stdout, stderr }));
    child.on("close", (code) => finish({ code, stdout, stderr }));
  });
}

/**
 * Return the media duration in seconds, or `null` if the file is unreadable /
 * has no duration / the probe times out.
 */
export async function probeDuration(filePath: string): Promise<number | null> {
  const result = await runProcess(
    ffprobeInstaller.path,
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ],
    PROBE_TIMEOUT_MS,
  );

  if (result.code !== 0) return null;
  const seconds = Number.parseFloat(result.stdout.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return seconds;
}

/** Where to grab the still: ~10% of the timeline, capped at 60s. */
export function thumbnailSecondsFor(durationSeconds: number | null): number {
  if (!durationSeconds || durationSeconds < 1) return 0;
  return Math.min(durationSeconds * 0.1, MAX_THUMBNAIL_SECONDS);
}

/**
 * Extract a single JPEG frame at `atSeconds` into `destination`. Returns `true`
 * on success (exit 0 and the file exists), `false` on any failure. Never throws.
 */
export async function extractThumbnail({
  source,
  destination,
  atSeconds,
}: {
  source: string;
  destination: string;
  atSeconds: number;
}): Promise<boolean> {
  const result = await runProcess(
    ffmpegInstaller.path,
    [
      "-y",
      "-ss",
      String(atSeconds),
      "-i",
      source,
      "-frames:v",
      "1",
      "-vf",
      "scale=640:-2",
      "-q:v",
      "3",
      destination,
    ],
    THUMBNAIL_TIMEOUT_MS,
  );

  if (result.code !== 0) return false;

  try {
    const stat = await fsp.stat(destination);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}
