import { supabase } from "./supabase";
 
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
    const row = {
      username:      c.username,
      password_hash: c.password || c.password_hash,
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
    password_hash: clerk.password,
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
    password_hash: clerk.password,
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
 
export const setCashBF = async (outlet, amount) => {
  await supabase.from("cash_ledger")
    .delete().eq("outlet_id", outlet).eq("balance_type", "bf");
  await supabase.from("cash_ledger").insert({
    outlet_id: outlet, date: new Date().toISOString().split("T")[0],
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
    balance_type: entry.type || "",
  });
  if (error) console.error("addBankEntry:", error);
};
 
export const getBankBF = async (outlet) => {
  const { data } = await supabase
    .from("bank_ledger").select("debit,credit")
    .eq("outlet_id", outlet).eq("balance_type", "bf");
  if (!data || !data.length) return 0;
  return data.reduce((s, r) => s + Number(r.debit) - Number(r.credit), 0);
};
 
export const setBankBF = async (outlet, amount) => {
  await supabase.from("bank_ledger")
    .delete().eq("outlet_id", outlet).eq("balance_type", "bf");
  await supabase.from("bank_ledger").insert({
    outlet_id: outlet, date: new Date().toISOString().split("T")[0],
    description: "Opening Balance", debit: amount > 0 ? amount : 0,
    credit: amount < 0 ? Math.abs(amount) : 0, balance_type: "bf",
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
    txn_type:     entry.txnType || "sale",   // sale | settlement | fee | adjustment
    debit:        entry.debit || 0,           // increases pending receivable (card sale)
    credit:       entry.credit || 0,          // decreases pending receivable (settlement / fee)
    ref:          entry.ref || "",
    balance_type: entry.type || "",
  });
  if (error) console.error("addCardEntry:", error);
  return !error;
};

export const getCardBF = async (outlet) => {
  const { data } = await supabase
    .from("card_ledger").select("debit,credit")
    .eq("outlet_id", outlet).eq("balance_type", "bf");
  if (!data || !data.length) return 0;
  return data.reduce((s, r) => s + Number(r.debit) - Number(r.credit), 0);
};

export const setCardBF = async (outlet, amount) => {
  await supabase.from("card_ledger")
    .delete().eq("outlet_id", outlet).eq("balance_type", "bf");
  await supabase.from("card_ledger").insert({
    outlet_id: outlet, date: new Date().toISOString().split("T")[0],
    description: "Opening Balance", debit: amount > 0 ? amount : 0,
    credit: amount < 0 ? Math.abs(amount) : 0, balance_type: "bf",
  });
};

// One settlement = money leaves the card receivable AND lands in a real
// bank account, net of the merchant discount fee. Writes both ledgers
// atomically-ish (sequential inserts) so Bank and Card stay reconciled.
export const settleCardToBank = async (outlet, { date, cardId, bankId, grossAmount, feePct, description }) => {
  const fee = Math.round(grossAmount * (Number(feePct) || 0) / 100 * 100) / 100;
  const net = grossAmount - fee;

  await supabase.from("card_ledger").insert({
    outlet_id: outlet, date, card_id: cardId,
    description: description || "Settlement to bank",
    txn_type: "settlement", debit: 0, credit: grossAmount,
  });

  if (fee > 0) {
    await supabase.from("card_ledger").insert({
      outlet_id: outlet, date, card_id: cardId,
      description: "Merchant discount fee", txn_type: "fee", debit: 0, credit: 0,
      ref: `fee:${fee}`, // informational; fee already netted out of settlement above
    });
  }

  const { error } = await supabase.from("bank_ledger").insert({
    outlet_id: outlet, date,
    description: description ? `${description} (card settlement)` : "Card settlement",
    debit: net, credit: 0, ref: bankId || "", balance_type: "",
  });
  if (error) console.error("settleCardToBank bank_ledger insert:", error);

  return { fee, net };
};
 
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