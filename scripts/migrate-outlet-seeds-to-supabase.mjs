// scripts/migrate-outlet-seeds-to-supabase.mjs
//
// One-time migration: copies OUTLET_INV_SEEDS (the old localStorage-only
// preset overrides from data/seeds.js) into the new Supabase tables
// (outlet_price_history + outlet_item_flags) introduced for date-effective
// outlet pricing. Safe to re-run — it SKIPS any outlet+item that already
// has a row in outlet_price_history, mirroring initOutletSeeds()'s old
// "only if not already set" behaviour.
//
// Usage:
//   node scripts/migrate-outlet-seeds-to-supabase.mjs
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment
// (service role, not anon — this writes across all outlets, bypassing RLS
// the same way your other migration scripts do).

import { createClient } from "@supabase/supabase-js";
import { OUTLET_INV_SEEDS, SEED_INVENTORY } from "../src/data/seeds.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Effective date for migrated seed prices — deliberately far in the past
// so these prices apply to ANY historical date lookup, matching the old
// flat (non-dated) behaviour of OUTLET_INV_SEEDS exactly.
const SEED_EFFECTIVE_DATE = "2000-01-01";

async function itemAlreadyMigrated(outlet, itemKey, isEmpty) {
  const { data, error } = await supabase
    .from("outlet_price_history")
    .select("item_key")
    .eq("outlet_id", outlet)
    .eq("item_key", itemKey)
    .eq("is_empty", isEmpty)
    .limit(1);
  if (error) {
    console.error(`Check failed for ${outlet}/${itemKey}:`, error.message);
    return true; // fail safe — don't overwrite if we can't confirm
  }
  return (data || []).length > 0;
}

async function migrateOutlet(outlet, overrides) {
  let migrated = 0, skipped = 0, failed = 0, orphaned = 0;

  for (const [seedCode, ov] of Object.entries(overrides || {})) {
    const isEmpty = false; // OUTLET_INV_SEEDS is main-inventory only (matches
                           // its original use with outletInvKey, not outletEmptyInvKey)

    // OUTLET_INV_SEEDS keys are plain item codes (e.g. "D0059"), but
    // outlet_price_history/outlet_item_flags are keyed by the composite
    // "code__supplier" used everywhere else in the app. Resolve the code
    // against SEED_INVENTORY to get its supplier and build the real key —
    // and skip cleanly if the code no longer exists in SEED_INVENTORY,
    // instead of writing an orphaned row nothing will ever match against.
    const masterItem = SEED_INVENTORY.find(i => i.code === seedCode);
    if (!masterItem) {
      console.warn(`  ⚠ SKIPPED — ${outlet}/${seedCode}: no matching item in SEED_INVENTORY (orphaned seed code)`);
      orphaned++;
      continue;
    }
    const itemKey = `${masterItem.code}__${masterItem.supplier}`;

    const already = await itemAlreadyMigrated(outlet, itemKey, isEmpty);
    if (already) { skipped++; continue; }

    const unitCost     = Number(ov.unitCost)     || 0;
    const sellingPrice = Number(ov.sellingPrice) || 0;
    const hidden       = !!ov.hidden;

    const { error: priceErr } = await supabase.from("outlet_price_history").insert({
      outlet_id: outlet,
      item_key: itemKey,
      is_empty: isEmpty,
      effective_date: SEED_EFFECTIVE_DATE,
      unit_cost: unitCost,
      selling_price: sellingPrice,
    });
    if (priceErr) {
      console.error(`  ✗ price ${outlet}/${itemKey}:`, priceErr.message);
      failed++;
      continue;
    }

    const { error: flagErr } = await supabase.from("outlet_item_flags").upsert({
      outlet_id: outlet,
      item_key: itemKey,
      is_empty: isEmpty,
      hidden,
    }, { onConflict: "outlet_id,item_key,is_empty" });
    if (flagErr) {
      console.error(`  ✗ flag  ${outlet}/${itemKey}:`, flagErr.message);
      failed++;
      continue;
    }

    migrated++;
  }

  console.log(`${outlet}: ${migrated} migrated, ${skipped} already present, ${orphaned} orphaned/skipped, ${failed} failed`);
}

async function main() {
  if (!OUTLET_INV_SEEDS || Object.keys(OUTLET_INV_SEEDS).length === 0) {
    console.log("OUTLET_INV_SEEDS is empty — nothing to migrate.");
    return;
  }

  console.log("Starting outlet seed migration to Supabase...\n");
  for (const [outlet, overrides] of Object.entries(OUTLET_INV_SEEDS)) {
    await migrateOutlet(outlet, overrides);
  }
  console.log("\nDone.");
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
