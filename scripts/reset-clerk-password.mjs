// scripts/reset-clerk-password.mjs
import { createClient } from "@supabase/supabase-js";

const [, , username, newPassword] = process.argv;
if (!username || !newPassword) {
  console.error("Usage: node scripts/reset-clerk-password.mjs <username> <newPassword>");
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
node scripts/check-auth-user.mjs Maheshi 'Jq6wLb3Ry'
async function main() {
  const email = `${username.toLowerCase()}@internal.myaccounts.local`;
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) { console.error("listUsers failed:", listErr.message); process.exit(1); }

  const user = list.users.find(u => u.email === email);
  if (!user) { console.error(`No auth user found for ${email}`); process.exit(1); }

  const { error: updErr } = await supabase.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });
  if (updErr) { console.error("Password reset failed:", updErr.message); process.exit(1); }

  console.log(`✓ Password reset for ${email}`);
}

main();