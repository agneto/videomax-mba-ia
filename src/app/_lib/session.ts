/**
 * Session read helper — F01 STUB / F02 HANDOFF POINT.
 *
 * F01 (Landing Page) needs to redirect authenticated visitors away from `/`,
 * but real sessions are owned by F02 (Authentication System). This file ships
 * a typed seam: `getSession()` resolves to `null` today, and F02 will replace
 * the implementation (cookie read + session lookup) WITHOUT changing any call
 * site. Keep the signature stable: callers `await getSession()` and branch on
 * a truthy result.
 */

export type Session = {
  userId: string;
};

export async function getSession(): Promise<Session | null> {
  // F02 will replace this stub with real session resolution.
  return null;
}
