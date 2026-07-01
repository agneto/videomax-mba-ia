import { describe, expect, it, vi } from "vitest";
import type { VideoDTO } from "@/app/_lib/videos/dto";
import { UploadClientError } from "@/app/_lib/videos/uploadClient";
import {
  type Uploader,
  createUploadQueue,
} from "@/app/_lib/videos/uploadQueue";

const tick = () => new Promise((r) => setTimeout(r, 0));

function fakeFile(name: string): File {
  return new File(["x"], name, { type: "video/mp4" });
}

function fakeDTO(id: string): VideoDTO {
  return {
    id,
    title: id,
    description: "",
    originalFilename: `${id}.mp4`,
    sizeBytes: 1,
    durationSeconds: null,
    containerFormat: "mp4",
    status: "validating",
    thumbnailUrl: `/api/videos/${id}/thumbnail`,
    hasCustomThumbnail: false,
    createdAt: new Date().toISOString(),
  };
}

type Deferred = {
  promise: Promise<VideoDTO>;
  resolve: (v: VideoDTO) => void;
  reject: (e: unknown) => void;
};

function makeUploader() {
  const calls: Array<{ file: File; deferred: Deferred }> = [];
  const uploader: Uploader = ({ file, signal }) => {
    let resolve!: (v: VideoDTO) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<VideoDTO>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    signal.addEventListener("abort", () =>
      reject(new DOMException("aborted", "AbortError")),
    );
    calls.push({ file, deferred: { promise, resolve, reject } });
    return promise;
  };
  return { uploader, calls };
}

describe("upload queue", () => {
  it("runs the first enqueued item immediately", () => {
    const { uploader } = makeUploader();
    const q = createUploadQueue(uploader, { autoDismissMs: 0 });
    q.enqueue([fakeFile("a.mp4")]);
    expect(q.getSnapshot()[0].status).toBe("uploading");
  });

  it("serializes the second item until the first finishes", async () => {
    const { uploader, calls } = makeUploader();
    const q = createUploadQueue(uploader, { autoDismissMs: 0 });
    q.enqueue([fakeFile("a.mp4"), fakeFile("b.mp4")]);

    expect(q.getSnapshot().map((i) => i.status)).toEqual([
      "uploading",
      "queued",
    ]);

    calls[0].deferred.resolve(fakeDTO("a"));
    await tick();

    expect(q.getSnapshot().map((i) => i.status)).toEqual([
      "done",
      "uploading",
    ]);
  });

  it("cancels the in-flight item and advances the queue", async () => {
    const { uploader } = makeUploader();
    const q = createUploadQueue(uploader, { autoDismissMs: 0 });
    const [first] = q.enqueue([fakeFile("a.mp4"), fakeFile("b.mp4")]);

    q.cancel(first.id);
    await tick();

    expect(q.getSnapshot().map((i) => i.status)).toEqual([
      "cancelled",
      "uploading",
    ]);
  });

  it("emits a snapshot on every state change", async () => {
    const { uploader, calls } = makeUploader();
    const q = createUploadQueue(uploader, { autoDismissMs: 0 });
    const listener = vi.fn();
    q.subscribe(listener);

    q.enqueue([fakeFile("a.mp4")]); // enqueue emit + uploading emit
    calls[0].deferred.resolve(fakeDTO("a"));
    await tick();

    expect(listener.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(q.getSnapshot()[0].status).toBe("done");
  });

  it("can retry a failed item", async () => {
    const { uploader, calls } = makeUploader();
    const q = createUploadQueue(uploader, { autoDismissMs: 0 });
    const [item] = q.enqueue([fakeFile("a.mp4")]);

    calls[0].deferred.reject(new UploadClientError("UPL_DISK_WRITE"));
    await tick();
    expect(q.getSnapshot()[0].status).toBe("failed");

    q.retry(item.id);
    expect(q.getSnapshot()[0].status).toBe("uploading");
    expect(calls.length).toBe(2);
  });
});
