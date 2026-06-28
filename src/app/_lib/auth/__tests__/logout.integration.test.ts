import { describe, expect, it } from "vitest";
import { logout } from "@/app/_lib/auth/logout";
import { createSession } from "@/app/_lib/auth/session-store";
import { prisma } from "@/app/_lib/db";
import {
  createUser,
  expectRedirect,
  putSessionCookie,
  rawSessionCookie,
} from "@tests/integration/helpers";

describe("logout action", () => {
  it("logout_deletes_session_and_clears_cookie", async () => {
    const user = await createUser();
    const sessionId = await createSession(user.id);
    putSessionCookie(sessionId);

    await expectRedirect(logout(), "/");

    expect(await prisma.session.findUnique({ where: { id: sessionId } })).toBeNull();
    // Cleared cookie -> empty value in the jar.
    expect(rawSessionCookie()).toBe("");
  });

  it("logout_is_idempotent_when_no_session_cookie_present", async () => {
    await expectRedirect(logout(), "/");
  });

  it("logout_is_idempotent_when_cookie_points_to_deleted_session", async () => {
    putSessionCookie("a-session-id-that-was-already-deleted");
    await expectRedirect(logout(), "/");
    expect(rawSessionCookie()).toBe("");
  });
});
