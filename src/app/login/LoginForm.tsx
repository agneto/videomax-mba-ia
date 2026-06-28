"use client";

import { useActionState } from "react";
import { login } from "@/app/_lib/auth/login";
import { initialAuthState } from "@/app/_lib/validation";

const inputClass =
  "w-full rounded-md border border-border px-3 py-2 text-foreground outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialAuthState);
  const formError = state.errors?._form?.[0];

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {formError ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {formError}
        </p>
      ) : null}

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-base font-semibold text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
      >
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
