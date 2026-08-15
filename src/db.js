import { supabase } from "./supabase";
import { hashPassword, isHashed } from "./utils/authcrypto"; 
// ─── OUTLETS ────────────────────────────────────────────────
const outletLabel = (o) => String(o?.id || o?.name || "").trim();

/** Keep your original shop list order; new outlets go at the end. */
export const sortOutletsByOrder = (names, canonicalOrder = []) => {
  const seen = new Set();
  const result = [];
  for (const n of canonicalOrder) {
    if (names.includes(n) && !seen.has(n)) { result.push(n); seen.add(n); }
  }
  for (const n of names) {
    if (!seen.has(n)) { result.push(n); seen.add(n); }
  }
  return result;
};

async function fetchOutletRows() {
  const { data, error } = await supabase.from("outlets").select("*");
  if (error) { console.error("fetchOutletRows:", error); return []; }
  return data || [];
}

async function insertOutletRow(name) {
  const id = String(name || "").trim();
  if (!id) return { ok: false, message: "Outlet name is required" };

  // Table needs id (shop code). Some schemas also require name — try both.
  const attempts = [{ id, name: id }, { id }];
  let lastError = null;
  for (const row of attempts) {
    const { error } = await supabase.from("outlets").insert(row);
    if (!error) return { ok: true };
    if (error.code === "23505") return { ok: true }; // already exists
    lastError = error;
    // Unknown column (e.g. no name column) — try next shape
    if (error.code === "PGRST204") continue;
  }
  console.error("insertOutletRow:", id, lastError);
  const msg = lastError?.message || "Could not save outlet";
  const detail = lastError?.details ? ` (${lastError.details})` : "";
  return { ok: false, message: msg + detail };
}

export const getOutlets = async (canonicalOrder = []) => {
  const rows = await fetchOutletRows();
  const names = rows.map(outletLabel).filter(Boolean);
  return sortOutletsByOrder(names, canonicalOrder);
};

export const ensureOutlets = async (fallbackNames = []) => {
  let rows = await fetchOutletRows();
  if (!rows.length && fallbackNames.length) {
    for (const n of fallbackNames) {
      await insertOutletRow(n);
    }
    rows = await fetchOutletRows();
  }
  const names = rows.map(outletLabel).filter(Boolean);
  return sortOutletsByOrder(names.length ? names : fallbackNames, fallbackNames);
};

export const addOutlet = async (name) => insertOutletRow(name);

export const deleteOutlet = async (name) => {
  const id = String(name || "").trim();
  const { error } = await supabase.from("outlets").delete().eq("id", id);
  if (error) {
    console.error("deleteOutlet:", error);
    return { ok: false, message: error.message };
  }
  return { ok: true };
};
 
// ─── CLERKS ─────────────────────────────────────────────────
export const getClerks = async () => {
  const { data, error } = await supabase.from("clerks").select("*").order("username");
  if (error) { console.error("getClerks:", error); return []; }
  return data.map(c => ({
    ...c,
    password: c.password_hash || "",
    outlets: c.outlet_ids?.length ? c.outlet_ids : (c.outlet ? [c.outlet] : []),
    outlet:  c.outlet_ids?.[0] || c.outlet || "",
  }));
};
 
export const saveClerks = async (clerks) => {
  for (const c of clerks) {
    const rawPw = c.password || c.password_hash;
    const row = {
      username:      c.username,
      password_hash: isHashed(rawPw) ? rawPw : await hashPassword(rawPw),
      designation:   c.designation,
      access:        c.access,
      outlet_ids:    Array.isArray(c.outlets) ? c.outlets : c.outlet ? [c.outlet] : [],
    };
    if (c.id && typeof c.id === "string" && c.id.length > 10) {
      await supabase.from("clerks").update(row).eq("id", c.id);
    } else {
      await supabase.from("clerks").insert(row);
    }
  }
};
 
export const addClerk = async (clerk) => {
  const { data, error } = await supabase.from("clerks").insert({
    username:      clerk.username,
    password_hash: isHashed(clerk.password) ? clerk.password : await hashPassword(clerk.password),
    designation:   clerk.designation,
    access:        clerk.access,
    outlet_ids:    Array.isArray(clerk.outlets) ? clerk.outlets : clerk.outlet ? [clerk.outlet] : [],
  }).select().single();
  if (error) { console.error("addClerk:", error); return null; }
  return data;
};
 
export const updateClerk = async (id, clerk) => {
  const { error } = await supabase.from("clerks").update({
    username:      clerk.username,
    password_hash: isHashed(clerk.password) ? clerk.password : await hashPassword(clerk.password),
    designation:   clerk.designation,
    access:        clerk.access,
    outlet_ids:    Array.isArray(clerk.outlets) ? clerk.outlets : clerk.outlet ? [clerk.outlet] : [],
  }).eq("id", id);
  if (error) console.error("updateClerk:", error);
};
 
export const deleteClerk = async (id) => {
  const { error } = await supabase.from("clerks").delete().eq("id", id);
  if (error) console.error("deleteClerk:", error);
};

// ─── ADMIN ACCOUNTS ─────────────────────────────────────────
// Replaces the old hardcoded admin/admin123 check. First-run setup:
// if app_admins has zero rows, the login screen offers to create one.
export const getAdminCount = async () => {
  const { count, error } = await supabase
    .from("app_admins").select("*", { count: "exact", head: true });
  if (error) { console.error("getAdminCount:", error); return 0; }
  return count || 0;
};

export const createAdmin = async (username, password) => {
  const password_hash = await hashPassword(password);
  const { error } = await supabase.from("app_admins")
    .insert({ username: username.trim().toLowerCase(), password_hash });
  if (error) { console.error("createAdmin:", error); return false; }
  return true;
};
export const signInAdminAuth = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return null;
  return data.session;
};

export const verifyAdminLogin = async (username, password) => {
  const { data, error } = await supabase.rpc("verify_admin_login", {
    p_username: username, p_password: password,
  });
  if (error) { console.error("verifyAdminLogin:", error); return false; }
  return !!data;
};

// Safe outlet lookup for the login dropdown — returns ONLY the
// outlets for the one username typed, never a password hash and
// never the whole clerks table.
export const getUsernameOutlets = async (username) => {
  if (!username?.trim()) return [];
  const { data, error } = await supabase.rpc("get_username_outlets", {
    p_username: username,
  });
  if (error) { console.error("getUsernameOutlets:", error); return []; }
  return data || [];
};


// Real Supabase Auth sign-in for clerks — succeeds only for clerks
// already migrated via scripts/migrate-clerk-to-auth.mjs. This is
// what gives the app a genuine auth.uid() session for staff, same
// as signInAdminAuth does for admins.
export const signInClerkAuth = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return null;
  return data.session;
};

// Profile lookup for an already-authenticated clerk (real Auth session
// already proved the password) — no password check here, so this stays
// safe to call even after Phase 5 retires password_hash entirely.
export const getClerkProfile = async (username, outlet) => {
  const { data, error } = await supabase.rpc("get_clerk_profile", {
    p_username: username, p_outlet: outlet,
  });
  if (error) { console.error("getClerkProfile:", error); return null; }
  return data || null;
};

// Clerk login check runs entirely inside the database — the
// password hash never crosses the wire, and the comparison never
// happens in the browser.
export const verifyClerkLogin = async (username, outlet, password) => {
  const { data, error } = await supabase.rpc("verify_clerk_login", {
    p_username: username, p_outlet: outlet, p_password: password,
  });
  if (error) { console.error("verifyClerkLogin:", error); return null; }
  return data || null;
};
 
// ─── SUPPLIERS ──────────────────────────────────────────────
// AFTER
export const getSuppliers = async () => {
  const { data, error } = await supabase
    .from("suppliers").select("*").order("sort_order", { ascending: true });
  if (error) { console.error("getSuppliers:", error); return []; }
  return data;
}; 
// ─── CHART OF ACCOUNTS ──────────────────────────────────────
export const getCOA = async () => {
  const { data, error } = await supabase.from("coa_accounts").select("*").order("id");
  if (error) { console.error("getCOA:", error); return []; }
  return data.map(a => ({ id: a.id, name: a.name, type: a.type, stmt: a.statement }));
};
 
export const saveCOA = async (accounts) => {
  for (const a of accounts) {
    await supabase.from("coa_accounts").upsert({
      id: a.id, name: a.name, type: a.type, statement: a.stmt,
    });
  }
};
 
// ─── INVENTORY MASTER ────────────────────────────────────────
export const getInventoryMaster = async () => {
  const { data, error } = await supabase.from("inventory_master").select("*");
  if (error) { console.error("getInventoryMaster:", error); return []; }
  return data.map(i => ({
    id: i.id, code: i.code, name: i.name, type: i.type,
    description: i.description, supplier: i.supplier_id,
    unitCost: Number(i.unit_cost), sellingPrice: Number(i.selling_price),
  }));
};
 
export const saveInventoryMaster = async (items) => {
  const rows = items.map(i => ({
    id: i.id, code: i.code, name: i.name, type: i.type,
    description: i.description, supplier_id: i.supplier,
    unit_cost: i.unitCost, selling_price: i.sellingPrice,
  }));
  const { error } = await supabase.from("inventory_master").upsert(rows);
  if (error) console.error("saveInventoryMaster:", error);
};
 
// ─── OUTLET INVENTORY ────────────────────────────────────────
export const getOutletInventory = async (outlet) => {
  const { data, error } = await supabase
    .from("outlet_inventory").select("*, inventory_master(*)")
    .eq("outlet_id", outlet);
  if (error) { console.error("getOutletInventory:", error); return []; }
  return data.map(r => ({
    id:           r.item_id,
    code:         r.inventory_master.code,
    name:         r.inventory_master.name,
    type:         r.inventory_master.type,
    description:  r.inventory_master.description,
    supplier:     r.inventory_master.supplier_id,
    unitCost:     Number(r.unit_cost),
    sellingPrice: Number(r.selling_price),
    qty:          Number(r.qty),
  }));
};
 
export const saveOutletInventory = async (outlet, items) => {
  const rows = items.map(i => ({
    outlet_id:     outlet,
    item_id:       i.id,
    qty:           i.qty || 0,
    unit_cost:     i.unitCost || 0,
    selling_price: i.sellingPrice || 0,
    updated_at:    new Date().toISOString(),
  }));
  const { error } = await supabase.from("outlet_inventory").upsert(rows, {
    onConflict: "outlet_id,item_id",
  });
  if (error) console.error("saveOutletInventory:", error);
};
 
export const updateOutletInventoryQty = async (outlet, itemId, qty) => {
  const { error } = await supabase.from("outlet_inventory")
    .upsert({ outlet_id: outlet, item_id: itemId, qty, updated_at: new Date().toISOString() },
             { onConflict: "outlet_id,item_id" });
  if (error) console.error("updateOutletInventoryQty:", error);
};
 
// ─── SALES ──────────────────────────────────────────────────
export const getSales = async (outlet) => {
  const { data, error } = await supabase
    .from("sales").select("*").eq("outlet_id", outlet).order("date", { ascending: false });
  if (error) { console.error("getSales:", error); return []; }
  return data.map(r => ({ ...r, outlet: r.outlet_id }));
};
 
export const addSale = async (outlet, sale) => {
  const { error } = await supabase.from("sales").insert({
    outlet_id:      outlet,
    date:           sale.date,
    items:          sale.items,
    total:          sale.total,
    payment_method: sale.paymentMethod || "cash",
    notes:          sale.notes || "",
  });
  if (error) console.error("addSale:", error);
};
 
// ─── PURCHASES ──────────────────────────────────────────────
export const getPurchases = async (outlet) => {
  const { data, error } = await supabase
    .from("purchases").select("*").eq("outlet_id", outlet).order("date", { ascending: false });
  if (error) { console.error("getPurchases:", error); return []; }
  return data.map(r => ({ ...r, outlet: r.outlet_id, supplier: r.supplier_id }));
};
 
export const addPurchase = async (outlet, purchase) => {
  const { error } = await supabase.from("purchases").insert({
    outlet_id:   outlet,
    date:        purchase.date,
    supplier_id: purchase.supplier,
    items:       purchase.items,
    total:       purchase.total,
    status:      purchase.status || "received",
    notes:       purchase.notes || "",
  });
  if (error) console.error("addPurchase:", error);
};
export const deleteSaleForDate = async (outlet, date, isEmptyBatch) => {
  const { data, error } = await supabase
    .from("sales").select("id, items")
    .eq("outlet_id", outlet).eq("date", date);
  if (error) { console.error("deleteSaleForDate (select):", error); return; }
  const idsToDelete = (data || [])
    .filter(r => (r.items || []).some(i => !!i.isEmptyItem) === !!isEmptyBatch)
    .map(r => r.id);
  if (idsToDelete.length === 0) return;
  const { error: delErr } = await supabase.from("sales").delete().in("id", idsToDelete);
  if (delErr) console.error("deleteSaleForDate (delete):", delErr);
};
 
// ─── RETURNS ────────────────────────────────────────────────
export const getReturns = async (outlet) => {
  const { data, error } = await supabase
    .from("returns").select("*").eq("outlet_id", outlet).order("date", { ascending: false });
  if (error) { console.error("getReturns:", error); return []; }
  return data;
};
 
export const addReturn = async (outlet, ret) => {
  const { error } = await supabase.from("returns").insert({
    outlet_id:   outlet,
    date:        ret.date,
    supplier_id: ret.supplier,
    items:       ret.items,
    total:       ret.total,
    notes:       ret.notes || "",
  });
  if (error) console.error("addReturn:", error);
};
 
// ─── TRANSFERS ──────────────────────────────────────────────
export const getTransfers = async (outlet) => {
  const [fromRes, toRes] = await Promise.all([
    supabase.from("transfers").select("*").eq("from_outlet_id", outlet).order("date", { ascending: false }),
    supabase.from("transfers").select("*").eq("to_outlet_id", outlet).order("date", { ascending: false }),
  ]);
  if (fromRes.error) console.error("getTransfers from:", fromRes.error);
  if (toRes.error)   console.error("getTransfers to:", toRes.error);
  const byId = new Map();
  [...(fromRes.data || []), ...(toRes.data || [])].forEach(r => byId.set(r.id, r));
  return [...byId.values()].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
};

export const addTransfer = async (transfer) => {
  const notes = transfer.notes || (transfer.type ? `type:${transfer.type}` : "");
  const { error } = await supabase.from("transfers").insert({
    from_outlet_id: transfer.from,
    to_outlet_id:   transfer.to,
    date:           transfer.date,
    items:          transfer.items,
    status:         transfer.status || "completed",
    notes,
  });
  if (error) { console.error("addTransfer:", error); return { ok: false, message: error.message }; }
  return { ok: true };
};
 
// ─── AP INVOICES ─────────────────────────────────────────────
export const getAPInvoices = async (outlet) => {
  const { data, error } = await supabase
    .from("ap_invoices").select("*").eq("outlet_id", outlet).order("date", { ascending: false });
  if (error) { console.error("getAPInvoices:", error); return []; }
  return data.map(r => ({
    ...r, supplier: r.supplier_id,
    amount: Number(r.amount), paid: Number(r.paid),
  }));
};
 
export const addAPInvoice = async (outlet, invoice) => {
  const { error } = await supabase.from("ap_invoices").insert({
    outlet_id:   outlet,
    supplier_id: invoice.supplier,
    date:        invoice.date,
    due_date:    invoice.dueDate || null,
    amount:      invoice.amount,
    paid:        invoice.paid || 0,
    status:      invoice.status || "unpaid",
    ref:         invoice.ref || "",
  });
  if (error) console.error("addAPInvoice:", error);
};
 
export const updateAPInvoice = async (id, updates) => {
  const { error } = await supabase.from("ap_invoices").update(updates).eq("id", id);
  if (error) console.error("updateAPInvoice:", error);
};
 
// ─── AP PAYMENTS ─────────────────────────────────────────────
export const getAPPayments = async (outlet) => {
  const { data, error } = await supabase
    .from("ap_payments").select("*").eq("outlet_id", outlet).order("date", { ascending: false });
  if (error) { console.error("getAPPayments:", error); return []; }
  return data;
};
 
export const addAPPayment = async (outlet, payment) => {
  const { error } = await supabase.from("ap_payments").insert({
    outlet_id:   outlet,
    invoice_id:  null,
    date:        payment.date,
    amount:      payment.amount,
    method:      payment.method,
    ref:         payment.ref || "",
    notes:       payment.invoiceId || "",
    supplier_id: payment.supplierId || "",
    inv_amt:     payment.invAmt || 0,
    discount:    payment.discount || 0,
    late_charge: payment.lateCharge || 0,
    bank_name:   payment.bankName || "",
    account_no:  payment.accountNo || "",
  });
  if (error) console.error("addAPPayment:", error);
};
 
// ─── AR LEDGER ───────────────────────────────────────────────
export const getARLedger = async (outlet) => {
  const { data, error } = await supabase
    .from("ar_ledger").select("*").eq("outlet_id", outlet).order("date");
  if (error) { console.error("getARLedger:", error); return []; }
  return data;
};
 
export const addAREntry = async (outlet, entry) => {
  const { error } = await supabase.from("ar_ledger").insert({
    outlet_id:   outlet,
    date:        entry.date,
    description: entry.description || "",
    debit:       entry.debit || 0,
    credit:      entry.credit || 0,
    ref:         entry.ref || "",
    account_id:  entry.ref || "", 
  });
  if (error) console.error("addAREntry:", error);
};
 
// ─── CASH LEDGER ─────────────────────────────────────────────
export const getCashLedger = async (outlet) => {
  const { data, error } = await supabase
    .from("cash_ledger").select("*").eq("outlet_id", outlet).order("date");
  if (error) { console.error("getCashLedger:", error); return []; }
  return data;
};
 
export const addCashEntry = async (outlet, entry) => {
  const { error } = await supabase.from("cash_ledger").insert({
    outlet_id:    outlet,
    date:         entry.date,
    description:  entry.description || "",
    debit:        entry.debit || 0,
    credit:       entry.credit || 0,
    ref:          entry.ref || "",
    balance_type: entry.type || "",
  });
  if (error) console.error("addCashEntry:", error);
};
 export const deleteCashEntryForDate = async (outlet, date, description) => {
  const { error } = await supabase
    .from("cash_ledger")
    .delete()
    .eq("outlet_id", outlet)
    .eq("date", date)
    .eq("description", description);
  if (error) console.error("deleteCashEntryForDate:", error);
};
export const getCashBF = async (outlet) => {
  const { data } = await supabase
    .from("cash_ledger").select("debit,credit")
    .eq("outlet_id", outlet).eq("balance_type", "bf");
  if (!data || !data.length) return 0;
  return data.reduce((s, r) => s + Number(r.debit) - Number(r.credit), 0);
};
 
// Returns the date stored against the Opening Balance (B/F) row, if any.
export const getCashBFDate = async (outlet) => {
  const { data } = await supabase
    .from("cash_ledger").select("date")
    .eq("outlet_id", outlet).eq("balance_type", "bf").limit(1);
  if (!data || !data.length) return null;
  return data[0].date;
};

export const setCashBF = async (outlet, amount, date) => {
  await supabase.from("cash_ledger")
    .delete().eq("outlet_id", outlet).eq("balance_type", "bf");
  await supabase.from("cash_ledger").insert({
    outlet_id: outlet, date: date || new Date().toISOString().split("T")[0],
    description: "Opening Balance", debit: amount > 0 ? amount : 0,
    credit: amount < 0 ? Math.abs(amount) : 0, balance_type: "bf",
  });
};
 
// ─── BANK LEDGER ─────────────────────────────────────────────
export const getBankLedger = async (outlet) => {
  const { data, error } = await supabase
    .from("bank_ledger").select("*").eq("outlet_id", outlet).order("date");
  if (error) { console.error("getBankLedger:", error); return []; }
  return data;
};
 
export const addBankEntry = async (outlet, entry) => {
  const { error } = await supabase.from("bank_ledger").insert({
    outlet_id:    outlet,
    date:         entry.date,
    description:  entry.description || "",
    debit:        entry.debit || 0,
    credit:       entry.credit || 0,
    ref:          entry.ref || "",
    bank_id:      entry.bankId || null,
    check_no:     entry.checkNo || "",
    balance_type: entry.type || "",
  });
  if (error) console.error("addBankEntry:", error);
  return !error;
};
 
export const getBankBF = async (outlet, bankId) => {
  let q = supabase.from("bank_ledger").select("debit,credit")
    .eq("outlet_id", outlet).eq("balance_type", "bf");
  if (bankId) q = q.eq("bank_id", bankId);
  const { data } = await q;
  if (!data || !data.length) return 0;
  return data.reduce((s, r) => s + Number(r.debit) - Number(r.credit), 0);
};

// Returns the date stored against a bank account's Opening Balance (B/F) row.
export const getBankBFDate = async (outlet, bankId) => {
  let q = supabase.from("bank_ledger").select("date")
    .eq("outlet_id", outlet).eq("balance_type", "bf");
  if (bankId) q = q.eq("bank_id", bankId);
  const { data } = await q.limit(1);
  if (!data || !data.length) return null;
  return data[0].date;
};

export const setBankBF = async (outlet, amount, bankId, date) => {
  let del = supabase.from("bank_ledger").delete()
    .eq("outlet_id", outlet).eq("balance_type", "bf");
  if (bankId) del = del.eq("bank_id", bankId);
  await del;
  await supabase.from("bank_ledger").insert({
    outlet_id: outlet, date: date || new Date().toISOString().split("T")[0],
    description: "Opening Balance", debit: amount > 0 ? amount : 0,
    credit: amount < 0 ? Math.abs(amount) : 0, balance_type: "bf",
    bank_id: bankId || null,
  });
};

// ─── CAPITAL LEDGER (partner contributions / drawings) ──────────
// Mirrors Excel CAPITAL sheet's "BY MR.K.K/K.J/K.M" (contributions)
// and "TO MR.K.K.Personal/K.J/K.M/Building Owner/Licensee/Manager Loan"
// (drawings) lines. direction: 'in' = contribution (BY), 'out' = drawing (TO).
export const getCapitalLedger = async (outlet) => {
  const { data, error } = await supabase
    .from("capital_ledger").select("*").eq("outlet_id", outlet).order("date");
  if (error) { console.error("getCapitalLedger:", error); return []; }
  return data;
};

export const addCapitalEntry = async (outlet, entry) => {
  const { error } = await supabase.from("capital_ledger").insert({
    outlet_id: outlet,
    date:      entry.date,
    party:     entry.party,
    direction: entry.direction, // 'in' | 'out'
    amount:    entry.amount || 0,
    notes:     entry.notes || "",
  });
  if (error) console.error("addCapitalEntry:", error);
};

export const deleteCapitalEntry = async (id) => {
  const { error } = await supabase.from("capital_ledger").delete().eq("id", id);
  if (error) console.error("deleteCapitalEntry:", error);
};

// ─── CRATE LEDGER (plastic & wood crates) ────────────────────────
// Mirrors Excel's PLASTIC CRATES / WOOD CRATES blocks on the EMPTY PL
// sheet. One row per (outlet, date, crate_type); balance is computed
// at read time from B/F + purchase + received − returned − ex − issued − sold − short.
export const getCrateLedger = async (outlet) => {
  const { data, error } = await supabase
    .from("crate_ledger").select("*").eq("outlet_id", outlet).order("date");
  if (error) { console.error("getCrateLedger:", error); return []; }
  return data;
};

// Upsert one day's movement row for a given crate type (date+type is unique).
export const upsertCrateEntry = async (outlet, entry) => {
  const { error } = await supabase.from("crate_ledger").upsert({
    outlet_id:  outlet,
    date:       entry.date,
    crate_type: entry.crateType,
    purchase:   entry.purchase || 0,
    received:   entry.received || 0,
    returned:   entry.returned || 0,
    ex:         entry.ex       || 0,
    issued:     entry.issued   || 0,
    sold:       entry.sold     || 0,
    short:      entry.short    || 0,
    notes:      entry.notes    || "",
  }, { onConflict: "outlet_id,date,crate_type" });
  if (error) console.error("upsertCrateEntry:", error);
};

export const deleteCrateEntry = async (id) => {
  const { error } = await supabase.from("crate_ledger").delete().eq("id", id);
  if (error) console.error("deleteCrateEntry:", error);
};

export const getCrateBF = async (outlet, crateType) => {
  const { data } = await supabase
    .from("crate_ledger").select("bf")
    .eq("outlet_id", outlet).eq("crate_type", crateType).eq("balance_type", "bf");
  if (!data || !data.length) return 0;
  return data.reduce((s, r) => s + Number(r.bf || 0), 0);
};

export const setCrateBF = async (outlet, crateType, amount) => {
  await supabase.from("crate_ledger")
    .delete().eq("outlet_id", outlet).eq("crate_type", crateType).eq("balance_type", "bf");
  await supabase.from("crate_ledger").insert({
    outlet_id: outlet, crate_type: crateType,
    date: "1970-01-01", // fixed sentinel date so BF row never collides with a real day's upsert
    bf: amount || 0, balance_type: "bf",
  });
};

// ─── CARD SETTLEMENT LEDGER ────────────────────────────────────
// Tracks card/POS sales as a receivable (debit) until the acquiring
// bank settles the batch to a real bank account (credit). Mirrors
// the Bank Ledger shape 1:1 so Reports.jsx can consume it the same
// way. card_id references bank_accounts.id where account_type='card'.
export const getCardLedger = async (outlet) => {
  const { data, error } = await supabase
    .from("card_ledger").select("*").eq("outlet_id", outlet).order("date");
  if (error) { console.error("getCardLedger:", error); return []; }
  return data;
};

export const addCardEntry = async (outlet, entry) => {
  const { error } = await supabase.from("card_ledger").insert({
    outlet_id:    outlet,
    date:         entry.date,
    card_id:      entry.cardId || null,
    description:  entry.description || "",
    txn_type:     entry.txnType || "sale",
    debit:        entry.debit || 0,
    credit:       entry.credit || 0,          // gross amount collected
    fee_pct:      entry.feePct || 0,          // admin's rate at time of entry
    interest:     entry.interest || 0,        // interest/commission actually deducted
    net:          entry.net ?? (Number(entry.credit || 0) - Number(entry.interest || 0)),
    ref:          entry.ref || "",
    balance_type: entry.type || "",
  });
  if (error) console.error("addCardEntry:", error);
  return !error;
};

export const getCardBF = async (outlet, cardId) => {
  let q = supabase.from("card_ledger").select("debit,credit")
    .eq("outlet_id", outlet).eq("balance_type", "bf");
  if (cardId) q = q.eq("card_id", cardId);
  const { data } = await q;
  if (!data || !data.length) return 0;
  return data.reduce((s, r) => s + Number(r.debit) - Number(r.credit), 0);
};

// Returns the date stored against a card account's Opening Balance (B/F) row.
export const getCardBFDate = async (outlet, cardId) => {
  let q = supabase.from("card_ledger").select("date")
    .eq("outlet_id", outlet).eq("balance_type", "bf");
  if (cardId) q = q.eq("card_id", cardId);
  const { data } = await q.limit(1);
  if (!data || !data.length) return null;
  return data[0].date;
};
export const setCardBF = async (outlet, amount, cardId, date) => {
  let del = supabase.from("card_ledger").delete()
    .eq("outlet_id", outlet).eq("balance_type", "bf");
  if (cardId) del = del.eq("card_id", cardId);
  await del;
  const { error } = await supabase.from("card_ledger").insert({
    outlet_id: outlet, date: date || new Date().toISOString().split("T")[0],
    card_id: cardId || null,
    description: "Opening Balance", debit: amount > 0 ? amount : 0,
    credit: amount < 0 ? Math.abs(amount) : 0, balance_type: "bf",
    txn_type: "bf", fee_pct: 0, interest: 0, net: 0,
  });
  if (error) { console.error("setCardBF:", error); return false; }
  return true;
};

// ─── Last Month Pending Amount — stored per card account, same
// delete-then-insert pattern as B/F above, so editing updates the
// existing value instead of creating duplicate rows. ────────────
export const getCardPending = async (outlet, cardId) => {
  let q = supabase.from("card_ledger").select("debit,credit")
    .eq("outlet_id", outlet).eq("balance_type", "pending");
  if (cardId) q = q.eq("card_id", cardId);
  const { data } = await q;
  if (!data || !data.length) return 0;
  return data.reduce((s, r) => s + Number(r.debit) - Number(r.credit), 0);
};

export const getCardPendingDate = async (outlet, cardId) => {
  let q = supabase.from("card_ledger").select("date")
    .eq("outlet_id", outlet).eq("balance_type", "pending");
  if (cardId) q = q.eq("card_id", cardId);
  const { data } = await q.limit(1);
  if (!data || !data.length) return null;
  return data[0].date;
};

export const setCardPending = async (outlet, amount, cardId, date) => {
  let del = supabase.from("card_ledger").delete()
    .eq("outlet_id", outlet).eq("balance_type", "pending");
  if (cardId) del = del.eq("card_id", cardId);
  await del;
  const { error } = await supabase.from("card_ledger").insert({
    outlet_id: outlet, date: date || new Date().toISOString().split("T")[0],
    card_id: cardId || null,
    description: "Last Month Pending Amount", debit: amount > 0 ? amount : 0,
    credit: amount < 0 ? Math.abs(amount) : 0, balance_type: "pending",
    txn_type: "pending", fee_pct: 0, interest: 0, net: 0,
  });
  if (error) { console.error("setCardPending:", error); return false; }
  return true;
};
// REMOVED — this is what wrote card settlement/fee rows into bank_ledger,
// which caused card details to leak onto the Bank page. Card Settlement
// and Bank Deposit are now fully independent: addCardEntry writes only
// to card_ledger, addBankEntry writes only to bank_ledger.
 
// ─── GENERAL LEDGER ──────────────────────────────────────────
export const getGL = async (outlet) => {
  const { data, error } = await supabase
    .from("general_ledger").select("*").eq("outlet_id", outlet).order("date");
  if (error) { console.error("getGL:", error); return []; }
  return data.map(r => ({ ...r, acc: r.account_id }));
};
 
export const addGLEntry = async (outlet, entry) => {
  const { error } = await supabase.from("general_ledger").insert({
    outlet_id:   outlet,
    date:        entry.date,
    account_id:  entry.acc || entry.account_id,
    description: entry.description || "",
    debit:       entry.debit || 0,
    credit:      entry.credit || 0,
    ref:         entry.ref || "",
    source:      entry.source || "manual",
  });
  if (error) console.error("addGLEntry:", error);
};
 
// ─── EXPENSES ────────────────────────────────────────────────
export const getExpenses = async (outlet) => {
  const { data, error } = await supabase
    .from("expenses").select("*").eq("outlet_id", outlet).order("date", { ascending: false });
  if (error) { console.error("getExpenses:", error); return []; }
  return data.map(r => ({
    ...r, acc: r.account_id, amount: Number(r.amount),
  }));
};
 
export const addExpense = async (outlet, expense) => {
  const { error } = await supabase.from("expenses").insert({
    outlet_id:   outlet,
    date:        expense.date,
    account_id:  expense.acc || expense.account_id,
    description: expense.description || "",
    amount:      expense.amount,
    paid_via:    expense.paidVia || "cash",
    ref:         expense.ref || "",
  });
  if (error) console.error("addExpense:", error);
};
// ─── DAILY OPENING STOCK ─────────────────────────────────────

export const getOpeningStock = async (outlet, date) => {
  const { data, error } = await supabase
    .from("outlet_daily_opening")
    .select("*")
    .eq("outlet_id", outlet)
    .eq("date", date);
  
  if (error) { 
    console.error("getOpeningStock error:", error); 
    return null; 
  }
  
  if (!data || data.length === 0) {
    console.log(`No opening stock found for ${outlet} on ${date}`);
    return null;
  }
  
  const main = {}, emp = {};
  data.forEach(r => {
    // Store by composite key: code__supplier (or just item_code if already composite)
    if (r.type === "emp") {
      emp[r.item_code] = Number(r.qty);
    } else {
      main[r.item_code] = Number(r.qty);
    }
  });
  
  console.log("✓ getOpeningStock loaded:", { main, emp });
  return { main, emp };
};

export const saveOpeningStock = async (outlet, date, mainMap, empMap) => {
  const rows = [];
  
  // mainMap keys are like "D0001__DCSL"
  Object.entries(mainMap || {}).forEach(([code, qty]) => {
    rows.push({
      outlet_id: outlet,
      date: date,
      item_code: code,  // ← Store the full composite key
      qty: Number(qty) || 0,
      type: "main"
    });
  });
  
  // empMap keys are like "DCSL__DEMP_Q" or item id
  Object.entries(empMap || {}).forEach(([id, qty]) => {
    rows.push({
      outlet_id: outlet,
      date: date,
      item_code: id,    // ← Store the full composite key or id
      qty: Number(qty) || 0,
      type: "emp"
    });
  });
  
  if (rows.length === 0) {
    console.log("saveOpeningStock: no rows to save");
    return;
  }
  
  console.log("Saving opening stock:", rows);
  
  const { error } = await supabase
    .from("outlet_daily_opening")
    .upsert(rows, { onConflict: "outlet_id,date,item_code,type" });
  
  if (error) {
    console.error("saveOpeningStock error:", error);
  } else {
    console.log("✓ Opening stock saved for", outlet, date);
  }
};
export const addSupplier = async (supplier) => {
  const { error } = await supabase.from("suppliers").insert({
    id:    supplier.id,
    name:  supplier.name,
    color: supplier.color || "#94a3b8",
  });
  if (error) console.error("addSupplier:", error);
};

const EMPTY_SUP_MAP = {
  "DCSL":         "2001-DCSL",
  "LION BREWERY": "2002-LION BREWERY",
  "UG":           "2003-UG",
  "DCSL BEER":    "2006-DCSL BEER",
  "TODDY":        "2007-TODDY",
};
// REPLACE WITH:
export async function saveEmptyInventoryMaster(items) {
  if (!items || items.length === 0) return;
  const { error } = await supabase
    .from("inventory_empty")
    .upsert(
      items.map(i => ({
        id:            i.id,
        code:          i.code,
        name:          i.name,
        supplier_id:   i.supplier,
        type:          "EMP",
        unit_cost:     Number(i.unitCost)     || 0,
        selling_price: Number(i.sellingPrice) || 0,
        qty:           Number(i.qty)          || 0,
      })),
      { onConflict: "id" }
    );
  if (error) console.error("saveEmptyInventoryMaster:", error);
  else console.log("Empty saved to inventory_empty ✓");
}

export async function getEmptyInventoryMaster() {
  const { data, error } = await supabase
    .from("inventory_empty")
    .select("*");
  if (error) { console.error("getEmptyInventoryMaster:", error); return []; }
  return data.map(i => ({
    id:           i.id,
    code:         i.code,
    name:         i.name,
    type:         i.type || "EMP",
    supplier:     i.supplier_id,
    unitCost:     Number(i.unit_cost)     || 0,
    sellingPrice: Number(i.selling_price) || 0,
    qty:          Number(i.qty)           || 0,
  }));
}
// ─── Manual Supplier B/F ───────────────────────────────────────────────
// Table: supplier_bf
//   columns: supplier_id (text, PK part), outlet (text, PK part, or 'ALL'),
//            bf_date (date), bf_amount (numeric), updated_at (timestamptz)
export async function getSupplierBF(supplierId, outlet = "ALL") {
  const { data, error } = await supabase
    .from("supplier_bf")
    .select("bf_date, bf_amount")
    .eq("supplier_id", supplierId)
    .eq("outlet", outlet)
    .maybeSingle();
  if (error) { console.error("getSupplierBF error:", error); return null; }
  if (!data) return null;
  return { date: data.bf_date, amount: Number(data.bf_amount) || 0 };
}

export async function setSupplierBF(supplierId, outlet = "ALL", date, amount) {
  const { data, error } = await supabase
    .from("supplier_bf")
    .upsert(
      { supplier_id: supplierId, outlet, bf_date: date, bf_amount: Number(amount) || 0, updated_at: new Date().toISOString() },
      { onConflict: "supplier_id,outlet" }
    )
    .select()
    .maybeSingle();
  if (error) { console.error("setSupplierBF error:", error); return null; }
  return { date: data.bf_date, amount: Number(data.bf_amount) || 0 };
}