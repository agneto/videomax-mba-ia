import { expect } from "vitest";
import { signSessionId, SESSION_COOKIE_NAME } from "@/app/_lib/cookies";
import { prisma } from "@/app/_lib/db";
import { hashPassword } from "@/app/_lib/password";

type CookieEntry = { value: string };

function ctx() {
  return globalThis as unknown as {
    __cookieJar: Map<string, CookieEntry>;
    __redirects: string[];
  };
}

export function cookieJar(): Map<string, CookieEntry> {
  return ctx().__cookieJar;
}

export function redirects(): string[] {
  return ctx().__redirects;
}

export function lastRedirect(): string | undefined {
  const all = redirects();
  return all[all.length - 1];
}

export function rawSessionCookie(): string | undefined {
  return cookieJar().get(SESSION_COOKIE_NAME)?.value;
}

/** Put a signed session cookie into the jar (simulating a returning request). */
export function putSessionCookie(sessionId: string): void {
  cookieJar().set(SESSION_COOKIE_NAME, { value: signSessionId(sessionId) });
}

export function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.append(key, value);
  }
  return data;
}

/** Assert that running `action` throws the mocked redirect to `to`. */
export async function expectRedirect(
  action: Promise<unknown>,
  to: string,
): Promise<void> {
  await expect(action).rejects.toThrow(/NEXT_REDIRECT/);
  expect(lastRedirect()).toBe(to);
}

type SeedUser = {
  email?: string;
  name?: string;
  password?: string;
  isAdmin?: boolean;
  isSuspended?: boolean;
};

export async function createUser(overrides: SeedUser = {}) {
  const {
    email = "ada@example.com",
    name = "Ada Lovelace",
    password = "analytical1",
    isAdmin = false,
    isSuspended = false,
  } = overrides;

  return prisma.user.create({
    data: {
      email: email.toLowerCase(),
      name,
      passwordHash: await hashPassword(password),
      isAdmin,
      isSuspended,
    },
  });
}
