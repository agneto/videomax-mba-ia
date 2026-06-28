import { describe, expect, it } from "vitest";
import { getSession } from "@/app/_lib/session";

describe("getSession (F01 stub)", () => {
  it("stub_returns_null_until_f02", async () => {
    await expect(getSession()).resolves.toBeNull();
  });
});
