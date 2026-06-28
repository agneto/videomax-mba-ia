"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/app/_lib/db";
import { setSessionCookie } from "@/app/_lib/cookies";
import { DUMMY_HASH, verifyPassword } from "@/app/_lib/password";
import { createSession } from "@/app/_lib/auth/session-store";
import {
  type AuthFormState,
  loginSchema,
} from "@/app/_lib/validation";

// One generic message for every failure path (unknown email, wrong password,
// suspended account) so the response never discloses which case occurred.
const GENERIC_ERROR: AuthFormState = {
  ok: false,
  errors: { _form: ["Invalid email or password"] },
};

/**
 * `login` Server Action: timing-hardened credential check. Always runs a
 * bcrypt compare — against a dummy hash when the email is unknown — and returns
 * the same generic error for unknown email, wrong password, and suspended user.
 */
export async function login(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return GENERIC_ERROR;
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // Keep timing comparable to the real path.
    await verifyPassword(parsed.data.password, DUMMY_HASH);
    return GENERIC_ERROR;
  }

  const passwordValid = await verifyPassword(
    parsed.data.password,
    user.passwordHash,
  );
  if (!passwordValid || user.isSuspended) {
    return GENERIC_ERROR;
  }

  const sessionId = await createSession(user.id);
  await setSessionCookie(sessionId);
  redirect("/app");
}
