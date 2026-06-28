import bcrypt from "bcryptjs";

/**
 * Password hashing helpers.
 *
 * Cost factor 12 is a sensible 2026 default for bcrypt. The `password_hash`
 * column is varchar(255) so a future move to argon2id is a value change, not a
 * schema migration.
 */
const COST_FACTOR = 12;

/**
 * A valid, pre-computed bcrypt hash used by the login path to run a real
 * `compare` even when the submitted email does not exist. This keeps the
 * unknown-email and wrong-password code paths timing-comparable, defending
 * against user-enumeration via response timing.
 */
export const DUMMY_HASH =
  "$2b$12$fWLRiU2Xim9xWyI6cAmxSeVcZXHhWxySdKUTla3nF7C7/Hh/ZApmC";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST_FACTOR);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
