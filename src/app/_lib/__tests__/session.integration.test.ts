import { describe, expect, it } from "vitest";
import { getSession } from "@/app/_lib/session";
import { createSession } from "@/app/_lib/auth/session-store";
import { prisma } from "@/app/_lib/db";
import {
  createUser,
  putSessionCookie,
  rawSessionCookie,
} from "@tests/integration/helpers";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("getSession", () => {
  it("get_session_returns_null_when_cookie_missing", async () => {
    expect(await getSession()).toBeNull();
  });

  it("get_session_returns_user_when_cookie_valid", async () => {
    const user = await createUser();
    putSessionCookie(await createSession(user.id));

    const session = await getSession();
    expect(session?.user.email).toBe(user.email);
    expect(session?.user.isAdmin).toBe(false);
  });

  it("get_session_returns_null_when_session_expired", async () => {
    const user = await createUser();
    const now = Date.now();
    const row = await prisma.session.create({
      data: {
        id: "expired-cookie-session",
        userId: user.id,
        expiresAt: new Date(now - DAY_MS),
        absoluteExpiresAt: new Date(now + 30 * DAY_MS),
      },
    });
    putSessionCookie(row.id);

    expect(await getSession()).toBeNull();
    expect(rawSessionCookie()).toBe("");
  });

  it("get_session_returns_null_when_absolute_cap_passed", async () => {
    const user = await createUser();
    const now = Date.now();
    const row = await prisma.session.create({
      data: {
        id: "capped-cookie-session",
        userId: user.id,
        expiresAt: new Date(now + 5 * DAY_MS),
        absoluteExpiresAt: new Date(now - DAY_MS),
      },
    });
    putSessionCookie(row.id);

    expect(await getSession()).toBeNull();
    expect(rawSessionCookie()).toBe("");
  });

  it("get_session_returns_null_when_user_suspended", async () => {
    const user = await createUser({ isSuspended: true });
    putSessionCookie(await createSession(user.id));
    expect(await getSession()).toBeNull();
  });

  it("get_session_slides_expiry_on_valid_read", async () => {
    const user = await createUser();
    const now = Date.now();
    const row = await prisma.session.create({
      data: {
        id: "slide-cookie-session",
        userId: user.id,
        expiresAt: new Date(now + 20 * DAY_MS),
        absoluteExpiresAt: new Date(now + 60 * DAY_MS),
      },
    });
    putSessionCookie(row.id);

    await getSession();

    const updated = await prisma.session.findUnique({ where: { id: row.id } });
    expect(updated!.expiresAt.getTime()).toBeGreaterThan(row.expiresAt.getTime());
  });

  it("get_session_exposes_is_admin_true_for_admin_user", async () => {
    const user = await createUser({ isAdmin: true });
    putSessionCookie(await createSession(user.id));

    const session = await getSession();
    expect(session?.user.isAdmin).toBe(true);
  });
});
