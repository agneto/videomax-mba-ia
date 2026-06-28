import { prisma } from "@/app/_lib/db";
import { clearSessionCookie, readSessionCookie } from "@/app/_lib/cookies";
import { readSession, refreshSession } from "@/app/_lib/auth/session-store";

/**
 * Session reader — consumed by every authenticated route.
 *
 * (F01 shipped this module as a stub returning `null`; F02 replaces the body
 * while keeping the exported `getSession` name and call sites intact.)
 *
 * Reads the signed `videomax_session` cookie, validates the opaque id against
 * the `session` row, slides the sliding expiry, and returns the current user —
 * or `null` when there is no valid session or the user is suspended.
 */

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
};

export type SessionResult = {
  user: SessionUser;
};

/**
 * Clearing a cookie is only allowed inside a Server Action or Route Handler.
 * `getSession` is also called during RSC render (read-only), where a cookie
 * write throws — so we swallow that error and let the stale cookie expire on
 * its own (the DB row is already gone / invalid).
 */
async function safeClearSessionCookie(): Promise<void> {
  try {
    await clearSessionCookie();
  } catch {
    // read-only render context — ignore
  }
}

export async function getSession(): Promise<SessionResult | null> {
  const sessionId = await readSessionCookie();
  if (!sessionId) return null;

  const session = await readSession(sessionId);
  if (!session) {
    await safeClearSessionCookie();
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.isSuspended) {
    await safeClearSessionCookie();
    return null;
  }

  await refreshSession(session);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin,
    },
  };
}
