import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Central definition of the session cookie. Every auth entry-point goes through
 * these helpers so the cookie attributes stay identical across set/clear and
 * across dev/prod.
 *
 * The cookie value is `<sessionId>.<signature>` where the signature is an
 * HMAC-SHA256 over the id keyed by SESSION_SECRET. The opaque id is already
 * high-entropy and re-validated against the DB, but signing additionally
 * rejects tampered cookies before any DB lookup.
 */
export const SESSION_COOKIE_NAME = "videomax_session";

// 60 days — matches the session's absolute expiry cap.
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 60;

type CookieOptions = {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
};

export function buildSessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
}

export function buildClearCookieOptions(): CookieOptions {
  return { ...buildSessionCookieOptions(), maxAge: 0 };
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSecret())
    .update(value)
    .digest("base64url");
}

export function signSessionId(sessionId: string): string {
  return `${sessionId}.${sign(sessionId)}`;
}

/**
 * Validate a signed cookie value and return the embedded session id, or `null`
 * when the value is malformed or the signature does not match.
 */
export function unsignSessionCookie(value: string | undefined): string | null {
  if (!value) return null;

  const lastDot = value.lastIndexOf(".");
  if (lastDot <= 0) return null;

  const sessionId = value.slice(0, lastDot);
  const signature = value.slice(lastDot + 1);
  const expected = sign(sessionId);

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expBuf)) return null;

  return sessionId;
}

export async function setSessionCookie(sessionId: string): Promise<void> {
  const store = await cookies();
  store.set(
    SESSION_COOKIE_NAME,
    signSessionId(sessionId),
    buildSessionCookieOptions(),
  );
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, "", buildClearCookieOptions());
}

export async function readSessionCookie(): Promise<string | null> {
  const store = await cookies();
  return unsignSessionCookie(store.get(SESSION_COOKIE_NAME)?.value);
}
