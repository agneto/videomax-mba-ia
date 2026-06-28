import { describe, expect, it } from "vitest";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/app/_lib/password";

describe("password", () => {
  it("hash_produces_bcrypt_output", async () => {
    const hash = await hashPassword("abc12345");
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(hash.length).toBeGreaterThanOrEqual(60);
  });

  it("verify_true_on_matching_hash", async () => {
    const hash = await hashPassword("analytical1");
    await expect(verifyPassword("analytical1", hash)).resolves.toBe(true);
  });

  it("verify_false_on_mismatching_hash", async () => {
    const hash = await hashPassword("analytical1");
    await expect(verifyPassword("different1", hash)).resolves.toBe(false);
  });

  it("dummy_hash_is_valid_bcrypt", async () => {
    expect(DUMMY_HASH).toMatch(/^\$2[aby]\$/);
    await expect(verifyPassword("anything", DUMMY_HASH)).resolves.toBe(false);
  });
});
