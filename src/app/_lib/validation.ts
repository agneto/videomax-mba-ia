import { z, type ZodError } from "zod";

/**
 * Shared zod schemas for the auth Server Actions and their tests.
 * Messages match PRD Section 6 (F02) Error Handling wording exactly so the
 * inline form errors are the source of truth in one place.
 */

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(120, "Name must be at most 120 characters"),
    email: z.email("Enter a valid email address").max(255),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Za-z]/, "Password must contain at least one letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Passwords do not match",
    path: ["passwordConfirmation"],
  });

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export type FieldErrors = Record<string, string[]>;

/** Shape returned by the auth Server Actions, consumed via `useActionState`. */
export type AuthFormState = {
  ok: boolean;
  errors?: FieldErrors;
};

export const initialAuthState: AuthFormState = { ok: false };

/**
 * Convert a ZodError into a `{ field: string[] }` map consumable by
 * `useActionState`. Issues without a field path are grouped under `_form`.
 */
export function formatZodErrors(error: ZodError): FieldErrors {
  const result: FieldErrors = {};

  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : "_form";
    (result[key] ??= []).push(issue.message);
  }

  return result;
}
