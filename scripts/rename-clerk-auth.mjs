// scripts/rename-clerk-auth.mjs
// ───────────────────────────────────────────────────────────
// ONE-TIME script — run locally, never deployed. Renames a clerk's
// username in the clerks table AND, if they've already been migrated
// to real Supabase Auth, updates their Auth email + user_metadata to
// match — so their real-Auth login keeps working under the new name.
//
// Use this instead of editing the username in the Admin window
// whenever the clerk has already been migrated (check-auth-user.mjs
// says their account exists). If they haven't been migrated yet,
// editing the Admin window directly is fine — there's no Auth
// account to keep in sync.
//
// USAGE (PowerShell):
//   $env:SUPABASE_URL="https://ikonkquwntbwkwancyyk.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="<paste service role key here>"
//   node scripts/rename-clerk-auth.mjs Prashanthni Prashanthini
// ───────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";

const [, , oldUsername, newUsername] = process.argv;

if (!oldUsername || !newUsername) {
  console.error("Usage: node scripts/rename-clerk-auth.mjs <oldUsername> <newUsername>");
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables first.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // 1. Rename in the clerks table (source of truth for the legacy path
  // and for outlet/access lookups).
  const { data: clerk, error: findErr } = await supabase
    .from("clerks")
    .select("*")
    .ilike("username", oldUsername)
    .maybeSingle();

  if (findErr) { console.error("Failed to look up clerk:", findErr.message); process.exit(1); }
  if (!clerk) { console.error(`No clerk found with username "${oldUsername}"`); process.exit(1); }

  const { error: updateErr } = await supabase
    .from("clerks")
    .update({ username: newUsername })
    .eq("id", clerk.id);

  if (updateErr) { console.error("Failed to rename in clerks table:", updateErr.message); process.exit(1); }
  console.log(`✓ Renamed in clerks table: ${clerk.username} → ${newUsername}`);

  // 2. If already migrated to real Auth, update their email + metadata
  // too, so their real-Auth session still works under the new name.
  const oldEmail = `${oldUsername.toLowerCase()}@internal.myaccounts.local`;
  const newEmail = `${newUsername.toLowerCase()}@internal.myaccounts.local`;

  const { data: list, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) { console.error("Failed to list auth users:", listErr.message); process.exit(1); }

  const authUser = list.users.find(u => u.email === oldEmail);

  if (!authUser) {
    console.log(`No Auth account found for ${oldEmail} — clerk not yet migrated, nothing more to do.`);
    console.log(`When you migrate them, use the new username: node scripts/migrate-clerk-to-auth.mjs ${newUsername} <password>`);
    return;
  }

  const { error: authUpdateErr } = await supabase.auth.admin.updateUserById(authUser.id, {
    email: newEmail,
    email_confirm: true,
    user_metadata: {
      ...authUser.user_metadata,
      username: newUsername,
    },
  });

  if (authUpdateErr) { console.error("Failed to update Auth account:", authUpdateErr.message); process.exit(1); }

  console.log(`✓ Auth account updated: ${oldEmail} → ${newEmail}`);
  console.log(`\n✓ Done. ${newUsername} can now sign in (same password as before) using the new username.`);
}

main();
