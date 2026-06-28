"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/app/_lib/db";
import { setSessionCookie } from "@/app/_lib/cookies";
import { hashPassword } from "@/app/_lib/password";
import { createSession } from "@/app/_lib/auth/session-store";
import {
  type AuthFormState,
  formatZodErrors,
  registerSchema,
} from "@/app/_lib/validation";

const DUPLICATE_EMAIL_ERROR = {
  email: ["An account with this email already exists — try logging in"],
};

/**
 * `register` Server Action: validate, enforce email uniqueness, hash the
 * password, create the user + an initial session, set the cookie, and redirect
 * to `/app`. On failure it returns a `useActionState`-friendly error map.
 */
export async function register(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    passwordConfirmation: String(formData.get("passwordConfirmation") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false, errors: formatZodErrors(parsed.error) };
  }

  const email = parsed.data.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, errors: DUPLICATE_EMAIL_ERROR };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  let sessionId: string;
  try {
    const user = await prisma.user.create({
      data: { name: parsed.data.name, email, passwordHash },
    });
    sessionId = await createSession(user.id);
  } catch (error) {
    // Unique-constraint race between the check above and the insert.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, errors: DUPLICATE_EMAIL_ERROR };
    }
    throw error;
  }

  await setSessionCookie(sessionId);
  redirect("/app");
}
