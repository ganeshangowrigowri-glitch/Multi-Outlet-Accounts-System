// scripts/migrate-clerk-to-auth.mjs
// ─────────────────────────────────────────────────────────────
// ONE-TIME script — run locally, NEVER deployed, NEVER committed
// with real secrets. Migrates a single clerk to real Supabase Auth,
// reading their existing outlets/access straight from the clerks
// table (no need to re-type them), and linking outlet_access for
// each of their actual outlets (clerks are outlet-scoped, unlike
// the admin's '*' wildcard from migrate-admin-to-auth.mjs).
//
// This does NOT touch the existing clerks/verify_clerk_login login
// flow — that keeps working exactly as it does today for every
// clerk not yet migrated. This just sets up the real Auth account
// in parallel.
//
// USAGE (PowerShell):
//   $env:SUPABASE_URL="https://ikonkquwntbwkwancyyk.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="<paste service role key here>"
//   node scripts/migrate-clerk-to-auth.mjs harish NewPassword123!
//
// The service-role key has full admin access to your database —
// never put it in .env, never paste it anywhere outside this
// one-off terminal command.
// ─────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";

const [, , username, newPassword] = process.argv;

if (!username || !newPassword) {
  console.error("Usage: node scripts/migrate-clerk-to-auth.mjs <username> <newPassword>");
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
  // 1. Look up the clerk's existing record — reuse their real
  // outlets/access/designation rather than re-entering them.
  const { data: clerk, error: findErr } = await supabase
    .from("clerks")
    .select("*")
    .ilike("username", username)
    .maybeSingle();

  if (findErr) {
    console.error("Failed to look up clerk:", findErr.message);
    process.exit(1);
  }
  if (!clerk) {
    console.error(`No clerk found with username "${username}"`);
    process.exit(1);
  }

  const outlets = clerk.outlet_ids || [];
  if (outlets.length === 0) {
    console.error(`Clerk "${username}" has no outlets assigned — nothing to link. Aborting.`);
    process.exit(1);
  }

  console.log(`Found clerk: ${clerk.username} (${clerk.designation}, ${clerk.access})`);
  console.log(`  outlets: ${outlets.join(", ")}`);

  const email = `${username.toLowerCase()}@internal.myaccounts.local`;
  console.log(`\nCreating Supabase Auth user (${email})...`);

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password: newPassword,
    email_confirm: true,
    user_metadata: {
      username: clerk.username,
      designation: clerk.designation,
      access: clerk.access,
      outlets,
      migrated_from: "clerks",
    },
  });

  if (createErr) {
    console.error("Failed to create auth user:", createErr.message);
    process.exit(1);
  }

  const userId = created.user.id;
  console.log(`Created auth user: ${userId}`);

  // 2. Link outlet_access — one row per outlet this clerk actually has.
  const rows = outlets.map(outletId => ({
    user_id: userId,
    outlet_id: outletId,
    access: clerk.access || "",
  }));

  const { error: linkErr } = await supabase.from("outlet_access").insert(rows);
  if (linkErr) {
    console.error("Failed to link outlet_access:", linkErr.message);
    process.exit(1);
  }

  console.log(`✓ Linked ${rows.length} outlet(s) in outlet_access.`);
  console.log("\n✓ Done. This clerk can now sign in via real Supabase Auth.");
  console.log(`  email:    ${email}`);
  console.log(`  password: (the one you just set)`);
  console.log("\nNothing about the existing login screen has changed yet for other");
  console.log("clerks — they keep working exactly as before until migrated too.");
}

main();