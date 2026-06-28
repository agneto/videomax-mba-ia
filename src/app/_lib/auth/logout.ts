"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie, readSessionCookie } from "@/app/_lib/cookies";
import { deleteSession } from "@/app/_lib/auth/session-store";

/**
 * `logout` Server Action: delete the session row if present, clear the cookie,
 * and redirect home. Idempotent — safe to call without a live session.
 */
export async function logout(): Promise<void> {
  const sessionId = await readSessionCookie();
  if (sessionId) {
    await deleteSession(sessionId);
  }
  await clearSessionCookie();
  redirect("/");
}
