import { describe, expect, it } from "vitest";
import { register } from "@/app/_lib/auth/register";
import { getSession } from "@/app/_lib/session";
import { prisma } from "@/app/_lib/db";
import { initialAuthState } from "@/app/_lib/validation";
import {
  createUser,
  expectRedirect,
  formData,
  rawSessionCookie,
} from "@tests/integration/helpers";

const validInput = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  password: "analytical1",
  passwordConfirmation: "analytical1",
};

describe("register action", () => {
  it("register_with_valid_inputs_creates_user_session_and_redirects", async () => {
    await expectRedirect(
      register(initialAuthState, formData(validInput)),
      "/app",
    );

    const user = await prisma.user.findUnique({
      where: { email: "ada@example.com" },
    });
    expect(user).not.toBeNull();

    const sessionCount = await prisma.session.count({
      where: { userId: user!.id },
    });
    expect(sessionCount).toBe(1);
    expect(rawSessionCookie()).toBeTruthy();
  });

  it("register_rejects_short_password_inline", async () => {
    const state = await register(
      initialAuthState,
      formData({ ...validInput, password: "abc1", passwordConfirmation: "abc1" }),
    );
    expect(state.ok).toBe(false);
    expect(state.errors?.password).toBeDefined();
    expect(await prisma.user.count()).toBe(0);
  });

  it("register_rejects_password_without_letter_inline", async () => {
    const state = await register(
      initialAuthState,
      formData({
        ...validInput,
        password: "12345678",
        passwordConfirmation: "12345678",
      }),
    );
    expect(state.errors?.password).toContain(
      "Password must contain at least one letter",
    );
  });

  it("register_rejects_password_without_number_inline", async () => {
    const state = await register(
      initialAuthState,
      formData({
        ...validInput,
        password: "abcdefgh",
        passwordConfirmation: "abcdefgh",
      }),
    );
    expect(state.errors?.password).toContain(
      "Password must contain at least one number",
    );
  });

  it("register_rejects_duplicate_email", async () => {
    await createUser({ email: "ada@example.com" });
    const state = await register(initialAuthState, formData(validInput));
    expect(state.errors?.email).toBeDefined();
    expect(await prisma.user.count()).toBe(1);
  });

  it("register_rejects_duplicate_email_case_insensitive", async () => {
    await createUser({ email: "ada@example.com" });
    const state = await register(
      initialAuthState,
      formData({ ...validInput, email: "ADA@EXAMPLE.COM" }),
    );
    expect(state.errors?.email).toBeDefined();
    expect(await prisma.user.count()).toBe(1);
  });

  it("register_rejects_password_confirmation_mismatch", async () => {
    const state = await register(
      initialAuthState,
      formData({ ...validInput, passwordConfirmation: "different1" }),
    );
    expect(state.errors?.passwordConfirmation).toBeDefined();
    expect(await prisma.user.count()).toBe(0);
  });

  it("register_auto_logs_user_in", async () => {
    await expectRedirect(
      register(initialAuthState, formData(validInput)),
      "/app",
    );
    const session = await getSession();
    expect(session?.user.email).toBe("ada@example.com");
  });

  it("register_stores_password_as_bcrypt_hash_not_plaintext", async () => {
    await expectRedirect(
      register(initialAuthState, formData(validInput)),
      "/app",
    );
    const user = await prisma.user.findUnique({
      where: { email: "ada@example.com" },
    });
    expect(user!.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(user!.passwordHash).not.toBe("analytical1");
  });
});
