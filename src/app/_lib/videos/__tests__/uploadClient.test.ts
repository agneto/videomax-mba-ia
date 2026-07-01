import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoDTO } from "@/app/_lib/videos/dto";
import {
  UploadClientError,
  uploadVideoFile,
} from "@/app/_lib/videos/uploadClient";

class FakeXHR {
  static instances: FakeXHR[] = [];
  upload: { onprogress: ((e: ProgressEvent) => void) | null } = {
    onprogress: null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 0;
  responseType = "";
  response: unknown = null;
  responseText = "";
  aborted = false;

  open() {}
  setRequestHeader() {}
  send() {
    FakeXHR.instances.push(this);
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }

  emitProgress(loaded: number, total: number) {
    this.upload.onprogress?.({
      lengthComputable: true,
      loaded,
      total,
    } as ProgressEvent);
  }
  succeed(dto: VideoDTO) {
    this.status = 201;
    this.response = dto;
    this.onload?.();
  }
  fail(status: number, body: unknown) {
    this.status = status;
    this.response = body;
    this.onload?.();
  }
  networkError() {
    this.onerror?.();
  }
}

const OriginalXHR = globalThis.XMLHttpRequest;

beforeEach(() => {
  FakeXHR.instances = [];
  // @ts-expect-error — swap in the fake for the duration of the test
  globalThis.XMLHttpRequest = FakeXHR;
});

afterEach(() => {
  globalThis.XMLHttpRequest = OriginalXHR;
});

function fakeFile(): File {
  return new File(["abc"], "clip.mp4", { type: "video/mp4" });
}

function lastXHR(): FakeXHR {
  return FakeXHR.instances[FakeXHR.instances.length - 1];
}

const dto: VideoDTO = {
  id: "v1",
  title: "clip",
  description: "",
  originalFilename: "clip.mp4",
  sizeBytes: 3,
  durationSeconds: null,
  containerFormat: "mp4",
  status: "validating",
  thumbnailUrl: "/api/videos/v1/thumbnail",
  hasCustomThumbnail: false,
  createdAt: new Date().toISOString(),
};

describe("uploadVideoFile", () => {
  it("emits progress events", async () => {
    const onProgress = vi.fn();
    const promise = uploadVideoFile({ file: fakeFile(), onProgress });
    const xhr = lastXHR();
    xhr.emitProgress(1, 3);
    xhr.emitProgress(2, 3);
    xhr.emitProgress(3, 3);
    xhr.succeed(dto);
    await promise;
    expect(onProgress).toHaveBeenNthCalledWith(1, { loaded: 1, total: 3 });
    expect(onProgress).toHaveBeenNthCalledWith(3, { loaded: 3, total: 3 });
  });

  it("resolves with the DTO on 201", async () => {
    const promise = uploadVideoFile({ file: fakeFile() });
    lastXHR().succeed(dto);
    await expect(promise).resolves.toEqual(dto);
  });

  it("rejects with a typed error on a 400 body", async () => {
    const promise = uploadVideoFile({ file: fakeFile() });
    lastXHR().fail(400, { code: "UPL_BAD_EXTENSION", message: "nope" });
    await expect(promise).rejects.toBeInstanceOf(UploadClientError);
    await expect(promise).rejects.toMatchObject({ code: "UPL_BAD_EXTENSION" });
  });

  it("rejects with UPL_INCOMPLETE on a network error", async () => {
    const promise = uploadVideoFile({ file: fakeFile() });
    lastXHR().networkError();
    await expect(promise).rejects.toMatchObject({ code: "UPL_INCOMPLETE" });
  });

  it("aborts when the abort signal fires", async () => {
    const controller = new AbortController();
    const promise = uploadVideoFile({
      file: fakeFile(),
      signal: controller.signal,
    });
    controller.abort();
    const xhr = lastXHR();
    expect(xhr.aborted).toBe(true);
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });
});
