import { describe, expect, it } from "vitest";
import { validateClientFile } from "@/app/_lib/videos/clientValidation";
import { getMaxVideoBytes } from "@/app/_lib/videos/constants";

function fakeFile(name: string, size: number): File {
  // A real File would allocate `size` bytes; stub the size getter instead so we
  // can represent a 2 GB file without allocating it.
  const file = new File(["x"], name, { type: "video/mp4" });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("validateClientFile", () => {
  it("accepts an MP4 under the limit", () => {
    expect(validateClientFile(fakeFile("x.mp4", 1024 * 1024))).toEqual({
      ok: true,
      extension: "mp4",
    });
  });

  it("accepts mov, mkv, webm, avi", () => {
    for (const ext of ["mov", "mkv", "webm", "avi"] as const) {
      expect(validateClientFile(fakeFile(`clip.${ext}`, 2048)).ok).toBe(true);
    }
  });

  it("accepts an uppercase extension", () => {
    expect(validateClientFile(fakeFile("X.MP4", 2048)).ok).toBe(true);
  });

  it("rejects an unknown extension", () => {
    expect(validateClientFile(fakeFile("x.mpg", 2048))).toEqual({
      ok: false,
      reason: "UPL_BAD_EXTENSION",
    });
  });

  it("rejects a file above the size limit", () => {
    const tooBig = getMaxVideoBytes() + 1;
    expect(validateClientFile(fakeFile("x.mp4", tooBig))).toEqual({
      ok: false,
      reason: "UPL_TOO_LARGE",
    });
  });

  it("rejects an empty file under the size rule", () => {
    expect(validateClientFile(fakeFile("x.mp4", 0))).toEqual({
      ok: false,
      reason: "UPL_TOO_LARGE",
    });
  });
});
