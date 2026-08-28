// src/components/staff/S_Bank.jsx
// ─────────────────────────────────────────────────────────────
//  Staff › Bank
//  Tabs:  Payment History
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { fmt, today } from "../../utils/helpers";
import { supabase } from "../../supabase";
import { I } from "../../utils/icons";
import { getBankLedger, getBankBF, getBankBFDate, setBankBF, addBankEntry, addCashEntry, getBankBFMonthly, getBankBFMonthlyDate, setBankBFMonthly, getBankPending, getBankPendingDate, setBankPending, getBankCD, getBankCDDate, setBankCD, getBankDifferent, setBankDifferent } from "../../db";
import { printLedger } from "../../utils/printLedger";

const monthStr = (d) => (d || today()).slice(0, 7);
const prevMonthStr = (m) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const monthRange = (m) => {
  const [y, mo] = m.split("-").map(Number);
  const lastDate = new Date(y, mo, 0).getDate();
  return [`${m}-01`, `${m}-${String(lastDate).padStart(2, "0")}`];
};


const ENTRY_TYPES = [
  { value: "deposit", label: "Deposit", gl: "1002" },
  { value: "cheque", label: "Cheque Payment", gl: "2001" },
  { value: "transfer", label: "Bank Transfer", gl: "1002" },
  { value: "withdrawal", label: "Withdrawal", gl: "1001" },
  { value: "other", label: "Other", gl: "1002" },
];

// ════════════════════════════════════════════════════════════
export default function S_Bank({ outlet, toast_ }) {
  const [tab, setTab] = useState(0);

  const [hasAccess, setHasAccess] = useState(true);
  const [outletBanks, setOutletBanks] = useState([]);

useEffect(() => {
  supabase.from("bank_accounts")
    .select("*")
    .eq("outlet_id", outlet)
    .eq("active", true)
    .eq("hidden", false)
    .then(({ data }) => { if (data) setOutletBanks(data.filter(a => a.account_type !== "card")); });
}, [outlet]);  

  if (!hasAccess) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>{I.lock}</div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Bank Module Disabled</div>
        <div style={{ fontSize: 12.5, color: "var(--mut)" }}>Contact your admin to enable bank access for this outlet.</div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Tab Bar ── */}
      <div className="stabs no-print" style={{ marginBottom: 16 }}>
        {[ "Payment History", "Bank Deposit", "Bank Ledger" ].map((t, i) => (
          <button key={i} className={`stab ${tab === i ? "act" : ""}`} onClick={() => setTab(i)}>
            {[ I.ap, I.bank, I.bank ][i]} {t}
          </button>
        ))}
      </div>

      
      {tab === 0 && <PaymentHistory outlet={outlet} />}
      {tab === 1 && <BankDepositForm outlet={outlet} outletBanks={outletBanks} toast_={toast_} />}
      {tab === 2 && <BankLedgerView outlet={outlet} outletBanks={outletBanks} toast_={toast_} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB 0 — New Entry  ← UNCHANGED from original
// ════════════════════════════════════════════════════════════
function NewEntry({ outlet, outletBanks, toast_ }) {
  const ledgerKey = oKey(outlet, "bank_ledger");

  const blank = {
    date: today(),
    bankId: outletBanks[0]?.id || "",
    type: "deposit",
    entryType: "in",
    chequeNo: "",
    chequeDate: "",
    payee: "",
    description: "",
    amount: "",
  };

  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState(null);

  const selectedBank = outletBanks.find(b => b.id === form.bankId);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function handleTypeChange(val) {
    setForm(f => ({
      ...f,
      type: val,
      entryType: ["cheque", "withdrawal"].includes(val) ? "out" : "in",
    }));
  }

  function save() {
    if (!form.bankId) { toast_("Select a bank account", "err"); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast_("Enter valid amount", "err"); return; }
    if (!form.description) { toast_("Enter a description", "err"); return; }

    const bank = outletBanks.find(b => b.id === form.bankId);
    const entry = {
      id: editId || uid(),
      date: form.date,
      bankId: form.bankId,
      bankName: bank?.bank || "",
      accountNo: bank?.accountNo || "",
      accountName: bank?.accountName || "",
      type: form.entryType,
      txnType: form.type,
      chequeNo: form.chequeNo,
      chequeDate: form.chequeDate,
      payee: form.payee,
      description: form.description,
      amount: parseFloat(form.amount),
      by: outlet,
    };

    const existing = ls(ledgerKey, []);
    let updated;
    if (editId) {
      updated = existing.map(e => e.id === editId ? entry : e);
      setEditId(null);
      toast_("Entry updated ✓");
    } else {
      updated = [...existing, entry];
      toast_("Entry saved ✓");
    }

    lss(ledgerKey, updated);
    setForm(blank);
  }

  function startEdit(e) {
    setEditId(e.id);
    setForm({
      date: e.date,
      bankId: e.bankId,
      type: e.txnType,
      entryType: e.type,
      chequeNo: e.chequeNo || "",
      chequeDate: e.chequeDate || "",
      payee: e.payee || "",
      description: e.description,
      amount: e.amount,
    });
    window.scrollTo(0, 0);
  }

  const isCheque = form.type === "cheque";

  return (
    <>
      {outletBanks.length === 0 && (
        <div className="card" style={{ marginBottom: 12, textAlign: "center", padding: 24 }}>
          <div style={{ fontSize: 12.5, color: "var(--mut)" }}>No bank accounts assigned to this outlet. Contact admin.</div>
        </div>
      )}

      {/* ── Entry Form ── */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="chd">
          <div>
            <h3>{editId ? "Edit Entry" : "New Bank Entry"}</h3>
            <p>{outlet}</p>
          </div>
          {editId && (
            <button className="btn btnsm" onClick={() => { setEditId(null); setForm(blank); }}>
              {I.x} Cancel Edit
            </button>
          )}
        </div>
        <div style={{ padding: 14 }}>
          <div className="fg">
            <div className="ff">
              <label>Date *</label>
              <input type="date" value={form.date} onChange={e => set("date", e.target.value)} />
            </div>
            <div className="ff">
              <label>Bank Account *</label>
              <select value={form.bankId} onChange={e => set("bankId", e.target.value)}>
                <option value="">Select bank account…</option>
                {outletBanks.map(b => (
                  <option key={b.id} value={b.id}>{b.bank} — {b.accountNo}</option>
                ))}
              </select>
            </div>
            <div className="ff">
              <label>Transaction Type *</label>
              <select value={form.type} onChange={e => handleTypeChange(e.target.value)}>
                {ENTRY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="ff">
              <label>Direction</label>
              <select value={form.entryType} onChange={e => set("entryType", e.target.value)}>
                <option value="in">Bank In (Debit)</option>
                <option value="out">Bank Out (Credit)</option>
              </select>
            </div>
            {isCheque && (
              <>
                <div className="ff">
                  <label>Cheque Number</label>
                  <input placeholder="e.g. CHQ-0042" value={form.chequeNo} onChange={e => set("chequeNo", e.target.value)} />
                </div>
                <div className="ff">
                  <label>Cheque Date</label>
                  <input type="date" value={form.chequeDate} onChange={e => set("chequeDate", e.target.value)} />
                </div>
              </>
            )}
            <div className="ff">
              <label>Payee / Payer</label>
              <input placeholder="e.g. Distilleries Co." value={form.payee} onChange={e => set("payee", e.target.value)} />
            </div>
            <div className="ff">
              <label>Amount (Rs.) *</label>
              <input type="number" placeholder="0.00" value={form.amount} onChange={e => set("amount", e.target.value)} />
            </div>
            <div className="ff" style={{ gridColumn: "1 / -1" }}>
              <label>Description / Narration *</label>
              <input placeholder="e.g. Payment to supplier" value={form.description} onChange={e => set("description", e.target.value)} />
            </div>
          </div>

          {selectedBank && (
            <div style={{ background: "var(--s2)", border: "1px solid var(--bdr)", borderRadius: 8, padding: "10px 14px", marginTop: 10, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12 }}>
              <span style={{ color: "var(--mut)" }}>Bank:</span> <strong>{selectedBank.bank}</strong>
              <span style={{ color: "var(--mut)" }}>Account:</span> <span className="mono">{selectedBank.accountNo}</span>
              <span style={{ color: "var(--mut)" }}>Name:</span> <span>{selectedBank.accountName}</span>
              <span style={{ color: "var(--mut)" }}>Branch:</span> <span>{selectedBank.branch}</span>
            </div>
          )}

          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <button className="btn btng" onClick={save}>
              {I.check} {editId ? "Update Entry" : "Save Entry"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
// TAB 1 — My Entries  (history moved from below New Entry form)
// ════════════════════════════════════════════════════════════
function MyEntries({ outlet, outletBanks, toast_ }) {
  const ledgerKey = oKey(outlet, "bank_ledger");
  const [entries, setEntries] = useState(() => ls(ledgerKey, []));

  function del(id) {
    const updated = entries.filter(e => e.id !== id);
    setEntries(updated);
    lss(ledgerKey, updated);
    toast_("Entry deleted");
  }

  const totalIn = entries.filter(e => e.type === "in").reduce((a, e) => a + e.amount, 0);
  const totalOut = entries.filter(e => e.type === "out").reduce((a, e) => a + e.amount, 0);

  return (
    <>
      {/* Summary */}
      <div className="sg3 no-print" style={{ marginBottom: 14 }}>
        <div className="sc"><div className="sl">Total Entries</div><div className="sa">{entries.length}</div></div>
        <div className="sc"><div className="sl">Total In</div><div className="sa cg">Rs.{fmt(totalIn)}</div></div>
        <div className="sc"><div className="sl">Total Out</div><div className="sa cr">Rs.{fmt(totalOut)}</div></div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="chd" style={{ padding: "12px 14px" }}>
          <h3>My Entries</h3>
          <button className="btn btnd btnsm no-print" onClick={() => window.print()}>
            {I.print} Print
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Bank</th>
                <th>Cheque No.</th>
                <th>Payee</th>
                <th>Description</th>
                <th>Type</th>
                <th className="rt">Amount</th>
                <th className="no-print" style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr><td colSpan={8}><div className="empty">No entries yet.</div></td></tr>
              )}
              {[...entries].reverse().map(e => (
                <tr key={e.id}>
                  <td className="mono">{e.date}</td>
                  <td>
                    <div style={{ fontSize: 12.5 }}>{e.bankName}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--mut)" }}>{e.accountNo}</div>
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>{e.chequeNo || "—"}</td>
                  <td style={{ fontSize: 12.5 }}>{e.payee || "—"}</td>
                  <td style={{ fontSize: 12.5 }}>{e.description}</td>
                  <td>
                    <span className={`badge ${e.type === "in" ? "ba" : "bd"}`}>
                      {e.type === "in" ? "In" : "Out"}
                    </span>
                  </td>
                  <td className={`rt mono bold ${e.type === "in" ? "cg" : "cr"}`}>
                    Rs.{fmt(e.amount)}
                  </td>
                  <td className="no-print">
                    <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                      <button className="btn btnsm" style={{ color: "var(--red)" }} onClick={() => del(e.id)} title="Delete">{I.trash}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
// TAB 2 — Payment History (from Accounts Payable → Pay Invoice)
// ════════════════════════════════════════════════════════════
  function PaymentHistory({ outlet }) {
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    supabase.from("ap_payments")
      .select("*")
      .eq("outlet_id", outlet)
      .order("date", { ascending: false })
      .then(({ data }) => { if (data) setPayments(data); });
  }, [outlet]);

  const suppliers = [...new Set(payments.map(p => p.supplier_id).filter(Boolean))];

  const [filterSup, setFilterSup] = useState("");
  const [filterType, setFilterType] = useState("");
  const [fromD, setFromD] = useState("");
  const [toD, setToD] = useState("");

  const rows = payments.filter(p => {
    if (filterSup && p.supplier_id !== filterSup) return false;
    if (filterType && p.method !== filterType) return false;
    if (fromD && p.date < fromD) return false;
    if (toD && p.date > toD) return false;
    return true;
  }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const totalPaid = rows.reduce((a, p) => a + (p.amount || 0), 0);
  const totalDisc = rows.reduce((a, p) => a + (p.discount || 0), 0);
  const totalLate = rows.reduce((a, p) => a + (p.lateCharge || 0), 0);

  return (
    <>
      {/* Summary */}
      <div className="sg4 no-print" style={{ marginBottom: 14 }}>
        <div className="sc"><div className="sl">Total Records</div><div className="sa">{rows.length}</div></div>
        <div className="sc"><div className="sl">Total Paid</div><div className="sa cg">Rs.{fmt(totalPaid)}</div></div>
        <div className="sc"><div className="sl">Total Discount</div><div className="sa">Rs.{fmt(totalDisc)}</div></div>
        <div className="sc"><div className="sl">Late Charges</div><div className="sa cr">Rs.{fmt(totalLate)}</div></div>
      </div>

      {/* Filters */}
      <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <select className="btn btnsm" value={filterSup} onChange={e => setFilterSup(e.target.value)}>
          <option value="">All Suppliers</option>
          {suppliers.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="btn btnsm" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {["Bank", "Cash", "Cheque", "Online"].map(t => <option key={t}>{t}</option>)}
        </select>
        <input type="date" className="btn btnsm" value={fromD} onChange={e => setFromD(e.target.value)} />
        <input type="date" className="btn btnsm" value={toD} onChange={e => setToD(e.target.value)} />
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="chd" style={{ padding: "12px 14px" }}>
          <h3>Invoice Payment History</h3>
          <button className="btn btnd btnsm no-print" onClick={() => window.print()}>
            {I.print} Print
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Supplier</th>
                <th>Invoice No</th>
                <th>Pay Type</th>
                <th>Bank / Account</th>
                <th>Check No</th>
                <th className="rt">Invoice Amt</th>
                <th className="rt">Paid</th>
                <th className="rt">Discount</th>
                <th className="rt">Late Charge</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={10}><div className="empty">No invoice payments recorded yet.</div></td></tr>
              )}
             {rows.map(p => (
  <tr key={p.id}>
    <td className="mono">{p.date}</td>
    <td style={{ fontSize: 12 }}>{p.supplier_id || "—"}</td>
    <td className="mono">{p.notes || "—"}</td>
    <td><span className={`badge ${p.method === "Cash" ? "ba" : "bb"}`}>{p.method}</span></td>
    <td style={{ fontSize: 11.5 }}>
      {p.bank_name
        ? <><span className="badge bb">{p.bank_name}</span>{" "}<span className="mono" style={{ fontSize: 11 }}>{p.account_no}</span></>
        : <span style={{ color: "var(--mut)" }}>—</span>
      }
    </td>
    <td className="mono" style={{ fontSize: 11.5 }}>{p.ref || "—"}</td>
    <td className="rt mono">Rs.{fmt(p.inv_amt || 0)}</td>
    <td className="rt mono cg bold">Rs.{fmt(p.amount)}</td>
    <td className="rt mono cg">Rs.{fmt(p.discount || 0)}</td>
    <td className="rt mono" style={{ color: (p.late_charge || 0) > 0 ? "var(--red)" : "var(--mut)" }}>
      {(parseFloat(p.late_charge) || 0) > 0 ? `Rs.${fmt(parseFloat(p.late_charge))}` : "—"}
    </td>
  </tr>
))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
// TAB 1 — Bank Deposit. Writes straight to bank_ledger with
// debit = amount, so it lands on the Credit (Cash In) side of
// the Bank Ledger and the running balance updates automatically.
// No card fields here — deliberately separate from Card Settlement.
// ════════════════════════════════════════════════════════════
function BankDepositForm({ outlet, outletBanks, toast_ }) {
  const [date, setDate] = useState(today());
  const [bankId, setBankId] = useState(outletBanks[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (outletBanks.length && !bankId) setBankId(outletBanks[0].id);
  }, [outletBanks]);

   async function save() {
    if (!bankId) { toast_("Select a bank account", "err"); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast_("Enter a valid amount", "err"); return; }
    setSaving(true);
    const ok = await addBankEntry(outlet, {
      date, bankId,
      description: description || "Bank deposit",
      debit: amt,   // displays under Credit (Cash In) per BankLedgerView's convention
      credit: 0,
    });
    if (ok) {
      // Cash physically left the till and went into the bank —
      // record it as a Cash Out entry on the In Hand Cash ledger.
      await addCashEntry(outlet, {
        date,
        description: description || "Bank Deposit",
        type: "out",
        debit: 0,
        credit: amt,
      });
    }
    setSaving(false);
    if (ok) {
      toast_("Deposit recorded ✓");
      setAmount(""); setDescription("");
    } else {
      toast_("Failed to save — check connection", "err");
    }
  }

  const selectedBank = outletBanks.find(b => b.id === bankId);

  return (
    <div className="card">
      <div className="chd"><h3>Bank Deposit</h3><p>{outlet}</p></div>
      <div style={{ padding: 14 }}>
        {outletBanks.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--mut)" }}>
            No bank accounts assigned to this outlet yet — ask your admin to add one in Bank Master.
          </div>
        ) : (
          <>
            <div className="fg">
              <div className="ff">
                <label>Date *</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="ff">
                <label>Bank Account *</label>
                <select value={bankId} onChange={e => setBankId(e.target.value)}>
                  {outletBanks.map(b => (
                    <option key={b.id} value={b.id}>{b.bank} — {b.account_no || b.accountNo}</option>
                  ))}
                </select>
              </div>
              <div className="ff">
                <label>Amount (Rs.) *</label>
                <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <div className="ff" style={{ gridColumn: "1 / -1" }}>
                <label>Description</label>
                <input placeholder="e.g. Daily cash banking" value={description} onChange={e => setDescription(e.target.value)} />
              </div>
            </div>

            {selectedBank && (
              <div style={{ background: "var(--s2)", border: "1px solid var(--bdr)", borderRadius: 8, padding: "10px 14px", marginTop: 10, fontSize: 12 }}>
                <span style={{ color: "var(--mut)" }}>Depositing into:</span>{" "}
                <strong>{selectedBank.bank} — {selectedBank.account_no || selectedBank.accountNo}</strong>
              </div>
            )}

            <div style={{ marginTop: 14 }}>
              <button className="btn btng" onClick={save} disabled={saving}>
                {I.check} {saving ? "Saving…" : "Save Deposit"}
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 10 }}>
              This only records money going into the bank. It appears on the Credit (Cash In) side of the
              Bank Ledger and updates the running balance automatically.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
// ════════════════════════════════════════════════════════════
// TAB — Bank Ledger (real Supabase data: deposits, withdrawals,
// AP invoice payments, expense payments, card settlements — anything
// that actually reached bank_ledger). Running balance shown per row.
// ════════════════════════════════════════════════════════════
function BankLedgerView({ outlet, outletBanks, toast_ }) {
const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [bankId, setBankId] = useState(outletBanks[0]?.id || "");
  const [month, setMonth] = useState(monthStr(today()));

  useEffect(() => {
    const [first, last] = monthRange(month);
    setFrom(first);
    setTo(last);
  }, [month]);

  useEffect(() => {
    if (outletBanks.length && !bankId) setBankId(outletBanks[0].id);
  }, [outletBanks]);

  useEffect(() => {
    setLoading(true);
    getBankLedger(outlet).then(data => { setEntries(data || []); setLoading(false); });
  }, [outlet]);

  const bankEntries = entries.filter(e =>
    e.bank_id === bankId && e.balance_type !== "bf" && e.balance_type !== "bf_monthly" &&
    e.balance_type !== "pending" && e.balance_type !== "cd_manual" && e.balance_type !== "different"
  );

  const [openingBF, setOpeningBF] = useState(0);
  const [bfDate, setBFD] = useState(today());
  const [bfIsAuto, setBfIsAuto] = useState(false);
  useEffect(() => {
    if (!bankId) return;
    (async () => {
      const saved = await getBankBFMonthly(outlet, bankId, month);
      if (saved !== null) {
        setOpeningBF(saved);
        setBFD((await getBankBFMonthlyDate(outlet, bankId, month)) || monthRange(month)[0]);
        setBfIsAuto(false);
      } else {
        const prev = prevMonthStr(month);
        const prevCD = await getBankCD(outlet, bankId, prev);
        const prevCDDate = await getBankCDDate(outlet, bankId, prev);
        setOpeningBF(prevCD || 0);
        setBFD(prevCDDate || monthRange(month)[0]);
        setBfIsAuto(true);
      }
    })();
  }, [outlet, bankId, month]);

  async function saveBF() {
    if (!bankId) { toast_ && toast_("Select a bank account first", "err"); return; }
    await setBankBFMonthly(outlet, parseFloat(openingBF) || 0, bankId, bfDate, month);
    const saved = await getBankBFMonthly(outlet, bankId, month);
    setOpeningBF(saved || 0);
    setBfIsAuto(false);
    toast_ && toast_("Balance B/F saved ✓");
  }

  async function computeFinalPendingBalance(outlet, bankId, m, allEntries) {
    const [first, last] = monthRange(m);
    const monthEntries = allEntries.filter(e =>
      e.bank_id === bankId &&
      e.balance_type !== "bf" && e.balance_type !== "bf_monthly" &&
      e.balance_type !== "pending" && e.balance_type !== "cd_manual" && e.balance_type !== "different" &&
      e.date >= first && e.date <= last
    );
    const mStoredIn  = monthEntries.reduce((a, e) => a + Number(e.debit  || 0), 0);
    const mStoredOut = monthEntries.reduce((a, e) => a + Number(e.credit || 0), 0);
    const mBf      = (await getBankBFMonthly(outlet, bankId, m)) || 0;
    const mPending = (await getBankPending(outlet, bankId, m)) || 0;
    const mCd      = (await getBankCD(outlet, bankId, m)) || 0;
    const mDiff    = await getBankDifferent(outlet, bankId, m);
    const mPendingBalance = mBf + mStoredIn - mStoredOut + mPending - mCd;
    return mDiff.sign === "-" ? mPendingBalance - mDiff.amount : mPendingBalance + mDiff.amount;
  }

  const [pendingAmt, setPendingAmt] = useState(0);
  const [pendingDate, setPendingDate] = useState(today());
  const [pendingIsAuto, setPendingIsAuto] = useState(false);
  useEffect(() => {
    if (!bankId) return;
    (async () => {
      const saved = await getBankPending(outlet, bankId, month);
      if (saved !== null) {
        setPendingAmt(saved);
        setPendingDate((await getBankPendingDate(outlet, bankId, month)) || monthRange(month)[0]);
        setPendingIsAuto(false);
      } else {
        const prev = prevMonthStr(month);
        const prevFinal = await computeFinalPendingBalance(outlet, bankId, prev, entries);
        setPendingAmt(prevFinal || 0);
        setPendingDate(monthRange(prev)[1]);
        setPendingIsAuto(true);
      }
    })();
  }, [outlet, bankId, month, entries]);

  async function savePending() {
    if (!bankId) { toast_ && toast_("Select a bank account first", "err"); return; }
    await setBankPending(outlet, parseFloat(pendingAmt) || 0, bankId, pendingDate, month);
    const saved = await getBankPending(outlet, bankId, month);
    setPendingAmt(saved || 0);
    setPendingIsAuto(false);
    toast_ && toast_("Last month pending amount saved ✓");
  }

  const [cdManual, setCdManual] = useState(0);
  const [cdManualDate, setCdManualDate] = useState(today());
  useEffect(() => {
    if (!bankId) return;
    getBankCD(outlet, bankId, month).then(v => setCdManual(v || 0));
    getBankCDDate(outlet, bankId, month).then(d => setCdManualDate(d || monthRange(month)[1]));
  }, [outlet, bankId, month]);

  async function saveCDManual() {
    if (!bankId) { toast_ && toast_("Select a bank account first", "err"); return; }
    await setBankCD(outlet, parseFloat(cdManual) || 0, bankId, cdManualDate, month);
    const saved = await getBankCD(outlet, bankId, month);
    setCdManual(saved || 0);
    toast_ && toast_("Balance C/D saved ✓");
  }

  const [diffAmt, setDiffAmt] = useState(0);
  const [diffSign, setDiffSign] = useState("+");
  useEffect(() => {
    if (!bankId) return;
    getBankDifferent(outlet, bankId, month).then(({ amount, sign }) => {
      setDiffAmt(amount); setDiffSign(sign);
    });
  }, [outlet, bankId, month]);

  async function saveDifferent() {
    if (!bankId) { toast_ && toast_("Select a bank account first", "err"); return; }
    await setBankDifferent(outlet, parseFloat(diffAmt) || 0, diffSign, bankId, month);
    const saved = await getBankDifferent(outlet, bankId, month);
    setDiffAmt(saved.amount); setDiffSign(saved.sign);
    toast_ && toast_("Different saved ✓");
  }

  const bf = Number(openingBF) || 0;

  const period = bankEntries
    .filter(e => (!from || e.date >= from) && (!to || e.date <= to))
    .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.created_at || "").localeCompare(b.created_at || ""));

  const storedIn  = period.reduce((a, e) => a + Number(e.debit || 0), 0);
  const storedOut = period.reduce((a, e) => a + Number(e.credit || 0), 0);

  const pendingBalance = bf + storedIn - storedOut + (Number(pendingAmt) || 0) - (Number(cdManual) || 0);
  const finalPendingBalance = diffSign === "-"
    ? pendingBalance - (Number(diffAmt) || 0)
    : pendingBalance + (Number(diffAmt) || 0);

  let running = bf;
  const selectedBank = outletBanks.find(b => b.id === bankId);

  const th = { padding: "6px 10px", fontSize: 10, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--mut2,var(--mut))", background: "var(--s3)", borderBottom: "1px solid var(--bdr)" };
  const td = { padding: "6px 10px", fontSize: 12 };

  const periodLabel = from || to
    ? `${from || "Start"} → ${to || "Today"}`
    : "All dates";
  const bankLabel = selectedBank
    ? `${selectedBank.bank} — ${selectedBank.account_no || selectedBank.accountNo}`
    : outlet;
      return (
    <div className="card">
      <div className="chd">
        <div>
          <h3>Bank Ledger</h3>
          <p>{bankLabel}</p>
        </div>
        {outletBanks.length > 0 && (
          <button className="btn btnd btnsm no-print" onClick={printLedger}>
            {I.print} Print
          </button>
        )}
      </div>

      <div className="no-print" style={{ padding: "12px 14px 0" }}>
        <div className="ff" style={{ maxWidth: 220 }}>
          <label>Select Month</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
        </div>
      </div>

            {outletBanks.length > 0 && (
        <div className="no-print" style={{ padding: "12px 14px 0", display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="ff" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
            <label>Balance B/F Date</label>
            <input type="date" value={bfDate} onChange={e => setBFD(e.target.value)} />
          </div>
          <div className="ff" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
            <label>Balance B/F (Rs.)</label>
            <input type="number" value={openingBF} onChange={e => setOpeningBF(e.target.value)} />
          </div>
          <button className="btn btnd btnsm" onClick={saveBF}>{I.check} Set</button>
        </div>
      )}
      {bfIsAuto && (
        <div className="no-print" style={{ padding: "0 14px 8px", fontSize: 10.5, color: "var(--mut)" }}>
          Carried forward from {prevMonthStr(month)}'s Balance C/D — click Set to confirm for this month.
        </div>
      )}

      {outletBanks.length > 0 && (
        <div className="no-print" style={{ padding: "0 14px", display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="ff" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
            <label>Pending Amount Date</label>
            <input type="date" value={pendingDate} onChange={e => setPendingDate(e.target.value)} />
          </div>
          <div className="ff" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
            <label>Last Month Pending Amount (Rs.)</label>
            <input type="number" value={pendingAmt} onChange={e => setPendingAmt(e.target.value)} />
          </div>
          <button className="btn btnd btnsm" onClick={savePending}>{I.check} Set</button>
        </div>
      )}
      {pendingIsAuto && (
        <div className="no-print" style={{ padding: "0 14px 8px", fontSize: 10.5, color: "var(--mut)" }}>
          Carried forward from {prevMonthStr(month)}'s Final Pending Balance — click Set to confirm for this month.
        </div>
      )}

      {outletBanks.length > 0 && (
        <div className="no-print" style={{ padding: "0 14px", display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="ff" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
            <label>Balance C/D Date</label>
            <input type="date" value={cdManualDate} onChange={e => setCdManualDate(e.target.value)} />
          </div>
          <div className="ff" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
            <label>Balance C/D Amount (Rs.)</label>
            <input type="number" value={cdManual} onChange={e => setCdManual(e.target.value)} />
          </div>
          <button className="btn btnd btnsm" onClick={saveCDManual}>{I.check} Set</button>
        </div>
      )}

      {outletBanks.length > 0 && (
        <div className="no-print" style={{ padding: "0 14px", display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="ff" style={{ marginBottom: 0, minWidth: 90 }}>
            <label>Sign</label>
            <select value={diffSign} onChange={e => setDiffSign(e.target.value)}>
              <option value="+">+</option>
              <option value="-">−</option>
            </select>
          </div>
          <div className="ff" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
            <label>Different (Rs.)</label>
            <input type="number" value={diffAmt} onChange={e => setDiffAmt(e.target.value)} />
          </div>
          <button className="btn btnd btnsm" onClick={saveDifferent}>{I.check} Set</button>
        </div>
      )}

      <div className="no-print" style={{ padding: "12px 14px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="ff" style={{ minWidth: 160 }}>
          <label>Bank *</label>
          <select value={bankId} onChange={e => setBankId(e.target.value)}>
            {outletBanks.length === 0 && <option value="">No bank accounts for this outlet</option>}
            {outletBanks.map(b => (
              <option key={b.id} value={b.id}>{b.bank} — {b.account_no || b.accountNo}</option>
            ))}
          </select>
        </div>
        <div className="ff">
          <label>Period From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div className="ff">
          <label>To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </div>

      {outletBanks.length === 0 ? (
        <div style={{ padding: 30, textAlign: "center", color: "var(--mut)" }}>
          No bank accounts assigned to this outlet yet — ask your admin to add one in Bank Master.
        </div>
      ) : (
        <div className="ledger-print-zone">
          <div className="ledger-print-header">
            <h1>Bank Ledger</h1>
            <p>{outlet}</p>
            <p>{bankLabel}</p>
            <p>Period: {periodLabel}</p>
          </div>

          <div className="ledger-print-table-wrap" style={{ overflowX: "auto" }}>
            <table className="ledger-print-tbl" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: "left" }}>Date</th>
                  <th style={{ ...th, textAlign: "left" }}>Check No</th>
                  <th style={{ ...th, textAlign: "left" }}>Description</th>
                  <th style={{ ...th, textAlign: "right" }}>Debit</th>
                  <th style={{ ...th, textAlign: "right" }}>Credit</th>
                  <th style={{ ...th, textAlign: "right" }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr className="ledger-bf-row" style={{ background: "var(--s2)" }}>
                  <td style={td} colSpan={5}><strong>Balance B/F</strong> <span style={{ fontWeight: 400, color: "var(--mut)" }}>({bfDate})</span></td>
                  <td className="rt" style={{ ...td, fontWeight: 700 }}>{fmt(bf)}</td>
                </tr>
                <tr style={{ background: "var(--s2)" }}>
                  <td style={td} colSpan={5}>
                    <strong>Last Month Pending Amount</strong> <span style={{ fontWeight: 400, color: "var(--mut)" }}>({pendingDate})</span>
                  </td>
                  <td className="rt" style={{ ...td, fontWeight: 700, color: "var(--grn,#4ade80)" }}>{fmt(pendingAmt)}</td>
                </tr>
                {loading && <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "var(--mut)" }}>Loading…</td></tr>}
                {!loading && period.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "var(--mut)" }}>No entries in this period</td></tr>
                )}

                {period.map(e => {
                  running += Number(e.debit || 0) - Number(e.credit || 0);
                  return (
                    <tr key={e.id} style={{ borderBottom: "1px solid rgba(63,63,70,.15)" }}>
                      <td className="ldate" style={td}>{e.date}</td>
                      <td style={td} className="mono">{e.check_no || "—"}</td>
                      <td className="ldesc" style={td}>{e.description}</td>
                      <td className="rt" style={td}>{e.credit > 0 ? fmt(e.credit) : ""}</td>
                      <td className="rt" style={td}>{e.debit > 0 ? fmt(e.debit) : ""}</td>
                      <td className="rt" style={{ ...td, fontWeight: 600 }}>{fmt(running)}</td>
                    </tr>
                  );
                })}

                <tr style={{ background: "var(--s2)" }}>
                  <td style={td} colSpan={5}><strong>Pending Balance</strong></td>
                  <td className="rt" style={{ ...td, fontWeight: 700 }}>{fmt(pendingBalance)}</td>
                </tr>
                <tr style={{ background: "var(--s2)" }}>
                  <td style={td} colSpan={5}>
                    <strong>Different</strong> <span style={{ fontWeight: 400, color: "var(--mut)" }}>({diffSign})</span>
                  </td>
                  <td className="rt" style={{ ...td, fontWeight: 700 }}>{fmt(diffAmt)}</td>
                </tr>
                <tr style={{ background: "var(--s2)" }}>
                  <td style={td} colSpan={5}><strong>Final Pending Balance</strong></td>
                  <td className="rt" style={{ ...td, fontWeight: 700 }}>{fmt(finalPendingBalance)}</td>
                </tr>
                <tr className="ledger-cd-row" style={{ background: "var(--s2)" }}>
                  <td style={td} colSpan={5}>
                    <strong>Balance C/D</strong> <span style={{ fontWeight: 400, color: "var(--mut)" }}>({cdManualDate})</span>
                  </td>
                  <td className="rt" style={{ ...td, fontWeight: 700 }}>{fmt(cdManual)}</td>
                </tr>
                <tr className="ledger-total-row" style={{ background: "var(--s3)", borderTop: "2px solid var(--bdr2,var(--bdr))" }}>
                  <td style={{ ...td, fontWeight: 700 }} colSpan={3}>Total</td>
                  <td className="rt" style={{ ...td, fontWeight: 700 }}>{fmt(storedOut)}</td>
                  <td className="rt" style={{ ...td, fontWeight: 700 }}>{fmt(storedIn)}</td>
                  <td style={td}></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}