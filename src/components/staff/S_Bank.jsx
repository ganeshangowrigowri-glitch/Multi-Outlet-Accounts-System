// src/components/staff/S_Bank.jsx
// ─────────────────────────────────────────────────────────────
//  Staff › Bank
//  Tabs:  Payment History
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { fmt, today } from "../../utils/helpers";
import { supabase } from "../../supabase";
import { I } from "../../utils/icons";



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
    .then(({ data }) => { if (data) setOutletBanks(data); });
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
        {[ "Payment History"].map((t, i) => (
          <button key={i} className={`stab ${tab === i ? "act" : ""}`} onClick={() => setTab(i)}>
            {[ I.ap][i]} {t}
          </button>
        ))}
      </div>

      
      {tab === 0 && <PaymentHistory outlet={outlet} />}
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
