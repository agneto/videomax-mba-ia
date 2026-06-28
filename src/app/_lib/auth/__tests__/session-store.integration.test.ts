import { describe, expect, it } from "vitest";
import { prisma } from "@/app/_lib/db";
import {
  createSession,
  deleteAllSessionsForUser,
  deleteSession,
  readSession,
  refreshSession,
} from "@/app/_lib/auth/session-store";
import { createUser } from "@tests/integration/helpers";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("session-store", () => {
  it("create_session_returns_base64url_id_and_inserts_row", async () => {
    const user = await createUser();
    const id = await createSession(user.id);

    expect(id).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const row = await prisma.session.findUnique({ where: { id } });
    expect(row).not.toBeNull();
    expect(row?.userId).toBe(user.id);

    const now = Date.now();
    expect(Math.abs(row!.expiresAt.getTime() - (now + 30 * DAY_MS))).toBeLessThan(
      60_000,
    );
    expect(
      Math.abs(row!.absoluteExpiresAt.getTime() - (now + 60 * DAY_MS)),
    ).toBeLessThan(60_000);
  });

  it("read_session_returns_row_when_fresh", async () => {
    const user = await createUser();
    const id = await createSession(user.id);
    expect(await readSession(id)).not.toBeNull();
  });

  it("read_session_returns_null_when_expired", async () => {
    const user = await createUser();
    const now = Date.now();
    const row = await prisma.session.create({
      data: {
        id: "expired-session-id",
        userId: user.id,
        expiresAt: new Date(now - DAY_MS),
        absoluteExpiresAt: new Date(now + 30 * DAY_MS),
      },
    });
    expect(await readSession(row.id)).toBeNull();
  });

  it("read_session_returns_null_when_absolute_cap_passed", async () => {
    const user = await createUser();
    const now = Date.now();
    const row = await prisma.session.create({
      data: {
        id: "capped-session-id",
        userId: user.id,
        expiresAt: new Date(now + 10 * DAY_MS),
        absoluteExpiresAt: new Date(now - DAY_MS),
      },
    });
    expect(await readSession(row.id)).toBeNull();
  });

  it("refresh_slides_expires_at_only_if_more_than_one_day_elapsed", async () => {
    const user = await createUser();
    const now = Date.now();

    // Fresh session (expiresAt ~ now+30d) -> no write.
    const freshId = await createSession(user.id);
    const fresh = await prisma.session.findUnique({ where: { id: freshId } });
    const refreshedFresh = await refreshSession(fresh!);
    expect(refreshedFresh.expiresAt.getTime()).toBe(fresh!.expiresAt.getTime());

    // Stale session (expiresAt ~ now+20d) -> slide forward to ~ now+30d.
    const stale = await prisma.session.create({
      data: {
        id: "stale-session-id",
        userId: user.id,
        expiresAt: new Date(now + 20 * DAY_MS),
        absoluteExpiresAt: new Date(now + 60 * DAY_MS),
      },
    });
    const refreshedStale = await refreshSession(stale);
    expect(refreshedStale.expiresAt.getTime()).toBeGreaterThan(
      stale.expiresAt.getTime(),
    );
    expect(
      Math.abs(refreshedStale.expiresAt.getTime() - (now + 30 * DAY_MS)),
    ).toBeLessThan(60_000);
  });

  it("refresh_never_moves_expires_at_past_absolute_cap", async () => {
    const user = await createUser();
    const now = Date.now();
    const capped = await prisma.session.create({
      data: {
        id: "near-cap-session-id",
        userId: user.id,
        expiresAt: new Date(now + DAY_MS),
        absoluteExpiresAt: new Date(now + 5 * DAY_MS),
      },
    });
    const refreshed = await refreshSession(capped);
    expect(refreshed.expiresAt.getTime()).toBe(
      capped.absoluteExpiresAt.getTime(),
    );
  });

  it("delete_session_removes_row", async () => {
    const user = await createUser();
    const id = await createSession(user.id);
    await deleteSession(id);
    expect(await readSession(id)).toBeNull();
  });

  it("delete_all_for_user_removes_every_row_for_user", async () => {
    const user = await createUser();
    await createSession(user.id);
    await createSession(user.id);
    await createSession(user.id);

    await deleteAllSessionsForUser(user.id);

    const count = await prisma.session.count({ where: { userId: user.id } });
    expect(count).toBe(0);
  });
});
