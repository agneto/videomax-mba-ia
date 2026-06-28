import { describe, expect, it } from "vitest";
import { login } from "@/app/_lib/auth/login";
import { prisma } from "@/app/_lib/db";
import { initialAuthState } from "@/app/_lib/validation";
import {
  createUser,
  expectRedirect,
  formData,
  rawSessionCookie,
} from "@tests/integration/helpers";

const GENERIC = "Invalid email or password";

describe("login action", () => {
  it("login_success_creates_session_and_redirects_to_app", async () => {
    const user = await createUser({
      email: "ada@example.com",
      password: "analytical1",
    });

    await expectRedirect(
      login(
        initialAuthState,
        formData({ email: "ada@example.com", password: "analytical1" }),
      ),
      "/app",
    );

    const sessionCount = await prisma.session.count({
      where: { userId: user.id },
    });
    expect(sessionCount).toBe(1);
    expect(rawSessionCookie()).toBeTruthy();
  });

  it("login_unknown_email_returns_generic_error", async () => {
    const state = await login(
      initialAuthState,
      formData({ email: "nobody@example.com", password: "whatever1" }),
    );
    expect(state.errors?._form).toEqual([GENERIC]);
    expect(await prisma.session.count()).toBe(0);
  });

  it("login_wrong_password_returns_generic_error", async () => {
    await createUser({ email: "ada@example.com", password: "analytical1" });
    const state = await login(
      initialAuthState,
      formData({ email: "ada@example.com", password: "wrongpass1" }),
    );
    expect(state.errors?._form).toEqual([GENERIC]);
    expect(await prisma.session.count()).toBe(0);
  });

  it("login_suspended_user_returns_generic_error", async () => {
    await createUser({
      email: "ada@example.com",
      password: "analytical1",
      isSuspended: true,
    });
    const state = await login(
      initialAuthState,
      formData({ email: "ada@example.com", password: "analytical1" }),
    );
    expect(state.errors?._form).toEqual([GENERIC]);
    expect(await prisma.session.count()).toBe(0);
  });

  it("login_validates_empty_email_or_password_with_generic_error", async () => {
    const state = await login(
      initialAuthState,
      formData({ email: "", password: "" }),
    );
    expect(state.errors?._form).toEqual([GENERIC]);
    // No field-specific disclosure.
    expect(state.errors?.email).toBeUndefined();
    expect(state.errors?.password).toBeUndefined();
  });
});
