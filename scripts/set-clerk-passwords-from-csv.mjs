// Sets each clerk's Supabase Auth password from a CSV you write (username,password).
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const DRY  = process.argv.includes("--dry-run");
const file = process.argv.slice(2).find(a => !a.startsWith("--")) || "clerk-passwords.csv";
const MIN_LEN = 6;

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

function parseCsv(path) {
  const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  const rows = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const i = raw.indexOf(",");
    if (i === -1) { rows.push({ bad: raw }); continue; }
    const username = raw.slice(0, i).trim().replace(/^"|"$/g, "");
    const password = raw.slice(i + 1).replace(/^"|"$/g, "");
    if (username.toLowerCase() === "username") continue;
    rows.push({ username, password });
  }
  return rows;
}

async function listAllAuthUsers() {
  const all = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    all.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return all;
}

async function main() {
  const rows = parseCsv(file);
  const byEmail = new Map((await listAllAuthUsers()).map(u => [u.email, u]));
  const seen = new Set();
  let ok = 0, failed = 0;

  for (const r of rows) {
    if (r.bad) { console.warn("⚠ SKIP malformed line (no comma)"); failed++; continue; }
    const uname = r.username;
    const email = `${uname.toLowerCase()}@internal.myaccounts.local`;

    if (seen.has(email)) { console.warn(`⚠ SKIP ${uname}: listed twice in the CSV`); failed++; continue; }
    seen.add(email);

    if (!r.password || r.password.length < MIN_LEN) {
      console.warn(`⚠ SKIP ${uname}: password must be at least ${MIN_LEN} characters`);
      failed++; continue;
    }
    const user = byEmail.get(email);
    if (!user) {
      console.warn(`⚠ SKIP ${uname}: no Supabase Auth user (run migrate-clerk-to-auth.mjs first)`);
      failed++; continue;
    }
    if (DRY) { console.log(`[dry-run] ${uname}: would set password (${r.password.length} chars)`); ok++; continue; }

    const { error } = await supabase.auth.admin.updateUserById(user.id, { password: r.password });
    if (error) { console.error(`✗ ${uname}: ${error.message}`); failed++; }
    else { console.log(`✓ ${uname}: password set`); ok++; }
  }

  console.log(`\nDone. ${ok} ${DRY ? "would be set" : "set"}, ${failed} skipped/failed.`);
  if (!DRY && ok) console.log(`Delete ${file} once you've shared the passwords.`);
}

main().catch(e => { console.error(e); process.exit(1); });
