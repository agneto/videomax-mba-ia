import { beforeEach, inject, vi } from "vitest";

// Provide the container connection string before any app module (db.ts) is
// imported by a test file, and a stable secret for cookie signing.
process.env.DATABASE_URL = inject("DATABASE_URL");
process.env.SESSION_SECRET ??= "integration-test-secret-0123456789abcdef";

// Shared, mutable per-test context lives on globalThis so the hoisted vi.mock
// factories below can reach it without referencing module-scoped imports.
type CookieEntry = { value: string };
const globalForTests = globalThis as unknown as {
  __cookieJar: Map<string, CookieEntry>;
  __redirects: string[];
};
globalForTests.__cookieJar = new Map();
globalForTests.__redirects = [];

// In-memory cookie store standing in for Next's request-scoped `cookies()`.
vi.mock("next/headers", () => ({
  cookies: async () => {
    const jar = (
      globalThis as unknown as { __cookieJar: Map<string, CookieEntry> }
    ).__cookieJar;
    return {
      get: (name: string) => {
        const entry = jar.get(name);
        return entry ? { name, value: entry.value } : undefined;
      },
      set: (name: string, value: string) => {
        jar.set(name, { value });
      },
      delete: (name: string) => {
        jar.delete(name);
      },
    };
  },
}));

// Capture redirects instead of performing them; mirror Next's throw-to-halt
// behavior so code after `redirect()` does not run.
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    (globalThis as unknown as { __redirects: string[] }).__redirects.push(path);
    const error = new Error(`NEXT_REDIRECT:${path}`) as Error & {
      digest: string;
    };
    error.digest = `NEXT_REDIRECT;replace;${path};307;`;
    throw error;
  },
}));

beforeEach(async () => {
  (
    globalThis as unknown as { __cookieJar: Map<string, CookieEntry> }
  ).__cookieJar.clear();
  (globalThis as unknown as { __redirects: string[] }).__redirects.length = 0;

  const { prisma } = await import("@/app/_lib/db");
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
});
