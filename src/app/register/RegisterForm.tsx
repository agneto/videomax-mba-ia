"use client";

import { useActionState } from "react";
import { register } from "@/app/_lib/auth/register";
import { initialAuthState } from "@/app/_lib/validation";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <p className="mt-1 text-sm text-red-600" role="alert">
      {messages[0]}
    </p>
  );
}

const inputClass =
  "w-full rounded-md border border-border px-3 py-2 text-foreground outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(
    register,
    initialAuthState,
  );
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {errors._form ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {errors._form[0]}
        </p>
      ) : null}

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">
          Full name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          aria-invalid={Boolean(errors.name)}
          className={inputClass}
        />
        <FieldError messages={errors.name} />
      </div>

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
          aria-invalid={Boolean(errors.email)}
          className={inputClass}
        />
        <FieldError messages={errors.email} />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(errors.password)}
          aria-describedby="password-hint"
          className={inputClass}
        />
        <p id="password-hint" className="mt-1 text-xs text-muted">
          At least 8 characters, including a letter and a number.
        </p>
        <FieldError messages={errors.password} />
      </div>

      <div>
        <label
          htmlFor="passwordConfirmation"
          className="mb-1 block text-sm font-medium"
        >
          Confirm password
        </label>
        <input
          id="passwordConfirmation"
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(errors.passwordConfirmation)}
          className={inputClass}
        />
        <FieldError messages={errors.passwordConfirmation} />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-base font-semibold text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
