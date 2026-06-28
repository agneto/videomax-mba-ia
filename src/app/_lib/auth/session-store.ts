import { randomBytes } from "node:crypto";
import type { Session } from "@prisma/client";
import { prisma } from "@/app/_lib/db";

/**
 * Low-level CRUD for the opaque `session` table.
 *
 * Sessions use a 30-day sliding window with a 60-day absolute cap. The sliding
 * expiry is only written when it would move by more than a day, so a busy
 * session does not generate a DB write on every authenticated request.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const SLIDING_TTL_MS = 30 * DAY_MS;
const ABSOLUTE_TTL_MS = 60 * DAY_MS;

function generateSessionId(): string {
  // 32 random bytes -> 43-char base64url string.
  return randomBytes(32).toString("base64url");
}

export async function createSession(userId: string): Promise<string> {
  const now = Date.now();
  const id = generateSessionId();

  await prisma.session.create({
    data: {
      id,
      userId,
      expiresAt: new Date(now + SLIDING_TTL_MS),
      absoluteExpiresAt: new Date(now + ABSOLUTE_TTL_MS),
    },
  });

  return id;
}

/**
 * Return the session row only when it is still valid (not past the sliding
 * expiry, not past the absolute cap). Returns `null` otherwise.
 */
export async function readSession(id: string): Promise<Session | null> {
  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() < now) return null;
  if (session.absoluteExpiresAt.getTime() < now) return null;

  return session;
}

/**
 * Slide `expires_at` forward to now + 30 days, capped at the absolute expiry.
 * No-ops (no DB write) when the new expiry would move by a day or less.
 * Returns the effective session row.
 */
export async function refreshSession(session: Session): Promise<Session> {
  const now = Date.now();
  const target = Math.min(now + SLIDING_TTL_MS, session.absoluteExpiresAt.getTime());

  if (target - session.expiresAt.getTime() <= DAY_MS) {
    return session;
  }

  return prisma.session.update({
    where: { id: session.id },
    data: { expiresAt: new Date(target) },
  });
}

export async function deleteSession(id: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id } });
}

export async function deleteAllSessionsForUser(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}
