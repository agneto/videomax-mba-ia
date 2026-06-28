import { describe, expect, it } from "vitest";
import { login } from "@/app/_lib/auth/login";
import { logout } from "@/app/_lib/auth/logout";
import { register } from "@/app/_lib/auth/register";
import { getSession } from "@/app/_lib/session";
import { prisma } from "@/app/_lib/db";
import { initialAuthState } from "@/app/_lib/validation";
import {
  expectRedirect,
  formData,
  rawSessionCookie,
} from "@tests/integration/helpers";

const credentials = {
  email: "ada@example.com",
  password: "analytical1",
};

describe("auth flow (end-to-end)", () => {
  it("register_then_login_then_logout_end_to_end", async () => {
    // 1. Register -> auto-logged-in, redirected to /app.
    await expectRedirect(
      register(
        initialAuthState,
        formData({
          name: "Ada Lovelace",
          ...credentials,
          passwordConfirmation: credentials.password,
        }),
      ),
      "/app",
    );

    // 2. The returned cookie identifies the new user.
    const afterRegister = await getSession();
    expect(afterRegister?.user.email).toBe(credentials.email);

    // 3. Logout clears the cookie and deletes the session row.
    await expectRedirect(logout(), "/");
    expect(rawSessionCookie()).toBe("");
    expect(await getSession()).toBeNull();
    expect(await prisma.session.count()).toBe(0);

    // 4. Login with the same credentials issues a fresh session.
    await expectRedirect(login(initialAuthState, formData(credentials)), "/app");
    const afterLogin = await getSession();
    expect(afterLogin?.user.email).toBe(credentials.email);
    expect(await prisma.session.count()).toBe(1);

    // 5. Final logout returns to the terminal logged-out state.
    await expectRedirect(logout(), "/");
    expect(await getSession()).toBeNull();
    expect(await prisma.session.count()).toBe(0);
  });
});
