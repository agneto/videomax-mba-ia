import { describe, expect, it } from "vitest";
import {
  formatZodErrors,
  loginSchema,
  registerSchema,
} from "@/app/_lib/validation";

const validRegister = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  password: "analytical1",
  passwordConfirmation: "analytical1",
};

describe("registerSchema", () => {
  it("register_accepts_valid_payload", () => {
    expect(registerSchema.safeParse(validRegister).success).toBe(true);
  });

  it("register_rejects_empty_name", () => {
    const result = registerSchema.safeParse({ ...validRegister, name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodErrors(result.error).name).toBeDefined();
    }
  });

  it("register_rejects_invalid_email", () => {
    const result = registerSchema.safeParse({
      ...validRegister,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodErrors(result.error).email).toBeDefined();
    }
  });

  it("register_rejects_short_password", () => {
    const result = registerSchema.safeParse({
      ...validRegister,
      password: "ab1",
      passwordConfirmation: "ab1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodErrors(result.error).password).toContain(
        "Password must be at least 8 characters",
      );
    }
  });

  it("register_rejects_password_missing_letter", () => {
    const result = registerSchema.safeParse({
      ...validRegister,
      password: "12345678",
      passwordConfirmation: "12345678",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodErrors(result.error).password).toContain(
        "Password must contain at least one letter",
      );
    }
  });

  it("register_rejects_password_missing_number", () => {
    const result = registerSchema.safeParse({
      ...validRegister,
      password: "abcdefgh",
      passwordConfirmation: "abcdefgh",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodErrors(result.error).password).toContain(
        "Password must contain at least one number",
      );
    }
  });

  it("register_rejects_password_confirmation_mismatch", () => {
    const result = registerSchema.safeParse({
      ...validRegister,
      passwordConfirmation: "analytical2",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodErrors(result.error).passwordConfirmation).toContain(
        "Passwords do not match",
      );
    }
  });
});

describe("loginSchema", () => {
  it("login_accepts_valid_payload", () => {
    expect(
      loginSchema.safeParse({ email: "ada@example.com", password: "x" }).success,
    ).toBe(true);
  });

  it("login_rejects_missing_fields", () => {
    expect(
      loginSchema.safeParse({ email: "ada@example.com" }).success,
    ).toBe(false);
  });
});

describe("formatZodErrors", () => {
  it("format_zod_errors_returns_field_map", () => {
    const result = registerSchema.safeParse({ ...validRegister, name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const map = formatZodErrors(result.error);
      expect(Array.isArray(map.name)).toBe(true);
    }
  });
});
