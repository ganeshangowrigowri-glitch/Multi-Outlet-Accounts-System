// scripts/check-auth-user.mjs
// ─────────────────────────────────────────────────────────────
// Debug script — checks the migrated auth user's status, and
// directly tests signInWithPassword (same call the app makes),
// bypassing the browser entirely.
//
// USAGE (PowerShell, same window where env vars are already set):
//   node scripts/check-auth-user.mjs KPUG62 "Some@!hxzpid8"
// ─────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";

const [, , username, password] = process.argv;

if (!username || !password) {
  console.error("Usage: node scripts/check-auth-user.mjs <username> <password>");
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY; // optional, see note below

if (!url || !serviceKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables first.");
  process.exit(1);
}

const email = `${username.toLowerCase()}@internal.myaccounts.local`;

async function main() {
  // 1. Check the user actually exists and is confirmed (using service role — admin API)
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: userList, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) {
    console.error("Failed to list users:", listErr.message);
    process.exit(1);
  }
  const found = userList.users.find(u => u.email === email);
  if (!found) {
    console.log(`✗ No auth user found with email ${email}`);
    console.log("  The migration script may not have actually completed successfully.");
    process.exit(1);
  }
  console.log(`✓ Found auth user: ${found.id}`);
  console.log(`  email_confirmed_at: ${found.email_confirmed_at || "(NOT confirmed!)"}`);
  console.log(`  created_at: ${found.created_at}`);

  // 2. Directly test signInWithPassword with an anon-key client (same as the app does)
  if (!anonKey) {
    console.log("\n(Set SUPABASE_ANON_KEY env var too, to also test the actual sign-in call.)");
    return;
  }
  const client = createClient(url, anonKey);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    console.log(`\n✗ signInWithPassword failed: ${error.message} (status: ${error.status})`);
  } else {
    console.log(`\n✓ signInWithPassword succeeded! Session user id: ${data.user.id}`);
  }
}

main();