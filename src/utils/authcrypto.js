// src/utils/authcrypto.js
// ─────────────────────────────────────────────────────────────
// Password hashing helper. Replaces plaintext password storage
// and plaintext "===" comparison throughout the app.
//
// IMPORTANT — HONEST SCOPE NOTE:
// This stops the two worst issues (plaintext passwords sitting in
// the database, and a hardcoded admin password baked into the
// client bundle). It does NOT provide full protection against
// someone who has your Supabase anon key directly querying tables
// via the REST API — that requires real Supabase Auth + Row Level
// Security scoped to auth.uid(), which is a larger migration.
// ─────────────────────────────────────────────────────────────
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

// Looks like a bcrypt hash already? ($2a$ / $2b$ / $2y$ prefix)
export const isHashed = (v) => typeof v === "string" && /^\$2[aby]\$/.test(v);

export async function hashPassword(plain) {
  if (!plain) return "";
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain, hash) {
  if (!plain || !hash) return false;
  // Defensive: if an old plaintext value somehow still exists (pre-migration
  // row that hasn't been re-saved yet), fall back to a direct compare so
  // existing accounts don't get silently locked out before admin resets them.
  if (!isHashed(hash)) return plain === hash;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
