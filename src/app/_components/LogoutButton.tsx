"use client";

import { logout } from "@/app/_lib/auth/logout";

/**
 * Reusable logout trigger. F02 ships the component; the feature that owns the
 * authenticated app shell (F04) embeds it. A bare `<form action={logout}>`
 * keeps it working without client JS.
 */
export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Log out
      </button>
    </form>
  );
}
