import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// cookies.ts imports next/headers; stub it so importing the module is safe in
// the jsdom unit environment (these tests only exercise the pure helpers).
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import {
  SESSION_COOKIE_NAME,
  buildClearCookieOptions,
  buildSessionCookieOptions,
  signSessionId,
  unsignSessionCookie,
} from "@/app/_lib/cookies";

describe("cookie options", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", "unit-test-secret-0123456789abcdef");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("cookie_name_is_videomax_session", () => {
    expect(SESSION_COOKIE_NAME).toBe("videomax_session");
  });

  it("set_cookie_uses_secure_in_production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(buildSessionCookieOptions().secure).toBe(true);
  });

  it("set_cookie_omits_secure_in_development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(buildSessionCookieOptions().secure).toBe(false);
  });

  it("cookie_is_httponly_and_samesite_lax", () => {
    const opts = buildSessionCookieOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
  });

  it("clear_cookie_sets_max_age_zero", () => {
    expect(buildClearCookieOptions().maxAge).toBe(0);
  });
});

describe("cookie signing", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", "unit-test-secret-0123456789abcdef");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round_trips_a_signed_session_id", () => {
    const signed = signSessionId("abc123");
    expect(unsignSessionCookie(signed)).toBe("abc123");
  });

  it("rejects_a_tampered_cookie", () => {
    const signed = signSessionId("abc123");
    expect(unsignSessionCookie(`${signed}tampered`)).toBeNull();
  });

  it("rejects_missing_or_malformed_values", () => {
    expect(unsignSessionCookie(undefined)).toBeNull();
    expect(unsignSessionCookie("no-signature")).toBeNull();
  });
});
