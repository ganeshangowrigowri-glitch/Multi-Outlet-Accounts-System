// scripts/migrate-admin-to-auth.mjs
// ─────────────────────────────────────────────────────────────
// ONE-TIME script — run locally, NEVER deployed, NEVER committed
// with real secrets. Creates a real Supabase Auth account for one
// admin and links it to outlet_access with full ('*') outlet access.
//
// This does NOT touch the existing app_admins/clerks login flow —
// that keeps working exactly as it does today. This just sets up
// the real Auth account in parallel so Phase 3 (switching the
// login screen) has something to switch to.
//
// USAGE (PowerShell):
//   $env:SUPABASE_URL="https://ikonkquwntbwkwancyyk.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="<paste service role key here>"
//   node scripts/migrate-admin-to-auth.mjs KPUG62 SomeNewPassword123!
//
// The service-role key has full admin access to your database —
// never put it in .env (Vite would NOT expose it since it's not
// VITE_-prefixed, but keep it out of any committed file regardless)
// and never paste it anywhere outside this one-off terminal command.
// ─────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";

const [, , username, newPassword] = process.argv;

if (!username || !newPassword) {
  console.error("Usage: node scripts/migrate-admin-to-auth.mjs <username> <newPassword>");
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
  const email = `${username.toLowerCase()}@internal.myaccounts.local`;

  console.log(`Creating Supabase Auth user for "${username}" (${email})...`);

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password: newPassword,
    email_confirm: true, // skip email verification — this is an internal synthetic email
    user_metadata: { username, migrated_from: "app_admins" },
  });

  if (createErr) {
    console.error("Failed to create auth user:", createErr.message);
    process.exit(1);
  }

  const userId = created.user.id;
  console.log(`Created auth user: ${userId}`);

  const { error: linkErr } = await supabase.from("outlet_access").insert({
    user_id: userId,
    outlet_id: "*", // wildcard = access to every outlet, matching admin's current access
    access: "admin",
  });

  if (linkErr) {
    console.error("Failed to link outlet_access:", linkErr.message);
    process.exit(1);
  }

  console.log("✓ Done. This account can now sign in via supabase.auth.signInWithPassword");
  console.log(`  email:    ${email}`);
  console.log(`  password: (the one you just set)`);
  console.log("\nNothing about the existing login screen has changed yet — this account");
  console.log("exists in parallel until Phase 3 switches the login flow over.");
}

main();