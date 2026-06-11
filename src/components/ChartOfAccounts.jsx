import { useState, useMemo, useEffect } from "react";
import { supabase } from "../supabase";
import { saveCOA } from "../db";
// ═══ FULL ACCOUNT LIST DATA ═══════════════════════════════════════════════════
const ACCOUNT_RANGES = [
  { range:"1000-1499", type:"Current Assets",           debit:"Asset",       credit:"Cash",      stmt:"Balance Sheet" },
  { range:"1500-1999", type:"Fixed Assets",             debit:"Asset",       credit:"Cash",      stmt:"Balance Sheet" },
  { range:"2000-2499", type:"Current Liabilities",      debit:"Cash",        credit:"Liability", stmt:"Balance Sheet" },
  { range:"2500-2999", type:"Long-Term Liabilities",    debit:"Cash",        credit:"Liability", stmt:"Balance Sheet" },
  { range:"3000-3999", type:"Equity / Capital",         debit:"Cash",        credit:"Capital",   stmt:"Balance Sheet" },
  { range:"4000-4999", type:"Income",                   debit:"Cash",        credit:"Income",    stmt:"P&L" },
  { range:"5000-5499", type:"Cost of Sales",            debit:"Cost of Sale",credit:"Inventory", stmt:"P&L" },
  { range:"5500-5999", type:"Expenses",                 debit:"Expense",     credit:"Cash",      stmt:"P&L" },
];

const DEFAULT_ACCOUNTS = [
  // Current Assets
  {id:"1001",name:"In Hand Cash",             type:"Current Asset",        stmt:"Balance Sheet", editable:false},
  {id:"1002",name:"Bank",                      type:"Current Asset",        stmt:"Balance Sheet", editable:false},
  {id:"1003-COM",name:"COM Bank",             type:"Current Asset",        stmt:"Balance Sheet", editable:false},
  {id:"1004-COM",name:"COM Bank 2",           type:"Current Asset",        stmt:"Balance Sheet", editable:false},
  {id:"1005-HNB",name:"HNB Bank",             type:"Current Asset",        stmt:"Balance Sheet", editable:false},
  {id:"1006-PB",name:"PB Bank",               type:"Current Asset",        stmt:"Balance Sheet", editable:false},
  {id:"1007-Visa",name:"Visa Card",           type:"Current Asset",        stmt:"Balance Sheet", editable:false},
  {id:"1008-Amex",name:"Amex Card",           type:"Current Asset",        stmt:"Balance Sheet", editable:false},
  {id:"1100",name:"Account Receivable",        type:"Current Asset",        stmt:"Balance Sheet", editable:false},
  {id:"1200",name:"Transfer Good Out",         type:"Current Asset",        stmt:"Balance Sheet", editable:false},
  {id:"1300",name:"Inventory",                 type:"Current Asset",        stmt:"Balance Sheet", editable:false},
  // Current Liabilities
  {id:"2000",name:"Accounts Payable",          type:"Current Liability",    stmt:"Balance Sheet", editable:false},
  {id:"2001-DCSL",name:"AP - DCSL",            type:"Current Liability",    stmt:"Balance Sheet", editable:false},
  {id:"2002-LION BREWERY",name:"AP - LION BREWERY",type:"Current Liability",stmt:"Balance Sheet", editable:false},
  {id:"2003-UG",name:"AP - UG",               type:"Current Liability",    stmt:"Balance Sheet", editable:false},
  {id:"2004-IDL",name:"AP - IDL",             type:"Current Liability",    stmt:"Balance Sheet", editable:false},
  {id:"2005-ROCKLAND",name:"AP - ROCKLAND",   type:"Current Liability",    stmt:"Balance Sheet", editable:false},
  {id:"2006-DCSL BEER",name:"AP - DCSL BEER", type:"Current Liability",    stmt:"Balance Sheet", editable:false},
  {id:"2007-TODDY",name:"AP - TODDY",          type:"Current Liability",    stmt:"Balance Sheet", editable:false},
  {id:"2008-LUXURY BRAND",name:"AP - LUXURY BRAND",type:"Current Liability",stmt:"Balance Sheet",editable:false},
  {id:"2009-SIGNATURE",name:"AP - SIGNATURE", type:"Current Liability",    stmt:"Balance Sheet", editable:false},
  {id:"2010-JSP",name:"AP - JSP",             type:"Current Liability",    stmt:"Balance Sheet", editable:false},
  {id:"2011-VA",name:"AP - VA",               type:"Current Liability",    stmt:"Balance Sheet", editable:false},
  {id:"2100",name:"Transfer Good In",          type:"Current Liability",    stmt:"Balance Sheet", editable:false},
  // Equity / Capital
  {id:"3001",name:"Owner's Capital",           type:"Equity/Capital",       stmt:"Balance Sheet", editable:false},
  {id:"3002",name:"Retained Earnings",         type:"Equity/Capital",       stmt:"Balance Sheet", editable:false},
  {id:"3003",name:"Personal Drawing",          type:"Equity/Capital",       stmt:"Balance Sheet", editable:false},
  {id:"3004",name:"UG Sales Commission",       type:"Equity/Capital",       stmt:"Balance Sheet", editable:false},
  {id:"3005",name:"IDL Sales Commission",      type:"Equity/Capital",       stmt:"Balance Sheet", editable:false},
  // Income
  {id:"4001",name:"Sales Revenue",             type:"Income",               stmt:"P&L",           editable:false},
  {id:"4100",name:"Discount Received",         type:"Income",               stmt:"P&L",           editable:false},
  {id:"4101",name:"UG Discount",               type:"Income",               stmt:"P&L",           editable:false},
  {id:"4102",name:"DCSL Discount",             type:"Income",               stmt:"P&L",           editable:false},
  {id:"4103",name:"IDL Discount",              type:"Income",               stmt:"P&L",           editable:false},
  {id:"4104",name:"Luxury Brand Discount",     type:"Income",               stmt:"P&L",           editable:false},
  {id:"4150",name:"Discount on Purchase",      type:"Income",               stmt:"P&L",           editable:false},
  {id:"4151",name:"DEMP1 Discount",            type:"Income",               stmt:"P&L",           editable:false},
  {id:"4152",name:"DEMP2 Discount",            type:"Income",               stmt:"P&L",           editable:false},
  {id:"4153",name:"DEMP3 Discount",            type:"Income",               stmt:"P&L",           editable:false},
  {id:"4154",name:"BEMP1 Discount",            type:"Income",               stmt:"P&L",           editable:false},
  {id:"4155",name:"TEMP1 Discount",            type:"Income",               stmt:"P&L",           editable:false},
  {id:"4156",name:"UEMP1 Discount",            type:"Income",               stmt:"P&L",           editable:false},
  {id:"4157",name:"HEMP1 Discount",            type:"Income",               stmt:"P&L",           editable:false},
  {id:"4200",name:"Interest Received",         type:"Income",               stmt:"P&L",           editable:false},
  {id:"4201",name:"Visa Card Interest Received",type:"Income",              stmt:"P&L",           editable:false},
  {id:"4250",name:"BY EPF",                    type:"Income",               stmt:"P&L",           editable:false},
  {id:"4300",name:"BY Bank",                   type:"Income",               stmt:"P&L",           editable:false},
  // Cost of Sales
  {id:"5001",name:"Cost Of Sales",             type:"Cost of Sale",         stmt:"P&L",           editable:false},
  // Expenses - Sale & Marketing
  {id:"5500",name:"Expense",                   type:"Expense",              stmt:"P&L",           editable:false},
  {id:"5501",name:"Discount - Customer",       type:"Sale & Marketing Expense", stmt:"P&L",      editable:false},
  {id:"5502",name:"N/Cooly",                   type:"Sale & Marketing Expense", stmt:"P&L",      editable:false},
  {id:"5503",name:"Transport",                 type:"Sale & Marketing Expense", stmt:"P&L",      editable:false},
  {id:"5504",name:"AM & Other Commission",     type:"Sale & Marketing Expense", stmt:"P&L",      editable:false},
  // Expenses - Administration
  {id:"5650",name:"Mess",                      type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5651",name:"General",                   type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5652",name:"Shop – Minor",              type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5653",name:"Shop – Inventory",          type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5654",name:"Head Office",               type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5655",name:"Colombo Office",            type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5656",name:"Badulla Office",            type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5657",name:"N'Eliya Office",            type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5658",name:"Electricity Bill",          type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5659",name:"Water Bill",                type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5660",name:"Telephone Bill",            type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5661",name:"Telecom Bill",              type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5662",name:"Shop Insurance",            type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5663",name:"Photocopy",                 type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5664",name:"Stationery",                type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5665",name:"Laundry Bill",              type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5666",name:"Staff Salary",              type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5667",name:"Extra Salary",              type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5668",name:"EPF/ETF",                   type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5669",name:"Mr.Mano",                   type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5670",name:"Mr.Jagath",                 type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5671",name:"Medical",                   type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5672",name:"Security",                  type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5673",name:"Bar Manager Traveling",     type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5674",name:"Day Sheet Traveling",       type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5675",name:"Bank Traveling",            type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5676",name:"KK Boss Traveling",         type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5677",name:"Jagath Diesel Bill",        type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5678",name:"Donation",                  type:"Administration Expense",   stmt:"P&L",      editable:false},
  {id:"5679",name:"Discount Staff",            type:"Administration Expense",   stmt:"P&L",      editable:false},
  // Finance Charge
  {id:"5800",name:"UC/MC Tax",                 type:"Finance Charge",           stmt:"P&L",      editable:false},
  {id:"5801",name:"VAT",                       type:"Finance Charge",           stmt:"P&L",      editable:false},
  {id:"5802",name:"SSCL",                      type:"Finance Charge",           stmt:"P&L",      editable:false},
  {id:"5803",name:"Income Tax",                type:"Finance Charge",           stmt:"P&L",      editable:false},
  {id:"5804",name:"Audit Fee",                 type:"Finance Charge",           stmt:"P&L",      editable:false},
  {id:"5805",name:"Bank Charge",               type:"Finance Charge",           stmt:"P&L",      editable:false},
  {id:"5806",name:"Bank OD Interest",          type:"Finance Charge",           stmt:"P&L",      editable:false},
  {id:"5807",name:"Visa Card Interest",        type:"Finance Charge",           stmt:"P&L",      editable:false},
  {id:"5808",name:"Amex Card Interest",        type:"Finance Charge",           stmt:"P&L",      editable:false},
  {id:"5809",name:"Pay Order Charge",          type:"Finance Charge",           stmt:"P&L",      editable:false},
  {id:"5810",name:"DCSL Late Pay Charge",      type:"Finance Charge",           stmt:"P&L",      editable:false},
  {id:"5811",name:"DCSL Beer Late Pay Charge", type:"Finance Charge",           stmt:"P&L",      editable:false},
  // Other Expenses
  {id:"5900",name:"Forge Note",                type:"Other Expense",            stmt:"P&L",      editable:false},
  {id:"5901",name:"PO Free",                   type:"Other Expense",            stmt:"P&L",      editable:false},
  {id:"5902",name:"License Owner Free",        type:"Other Expense",            stmt:"P&L",      editable:false},
  {id:"5903",name:"Bank/AG Free",              type:"Other Expense",            stmt:"P&L",      editable:false},
  {id:"5904",name:"Price Control",             type:"Other Expense",            stmt:"P&L",      editable:false},
  {id:"5905",name:"Labour Office Free",        type:"Other Expense",            stmt:"P&L",      editable:false},
  {id:"5906",name:"Ex Station",               type:"Other Expense",            stmt:"P&L",      editable:false},
  {id:"5907",name:"Ex. S1 - OIC",             type:"Other Expense",            stmt:"P&L",      editable:false},
  {id:"5908",name:"Ex. S2 - AC",              type:"Other Expense",            stmt:"P&L",      editable:false},
  {id:"5909",name:"Ex.2 – SE",               type:"Other Expense",            stmt:"P&L",      editable:false},
  {id:"5910",name:"Ex.3 – SOB",              type:"Other Expense",            stmt:"P&L",      editable:false},
  {id:"5911",name:"Ex.4 – Inspection",       type:"Other Expense",            stmt:"P&L",      editable:false},
  {id:"5912",name:"Ex.5 – Ex Free",          type:"Other Expense",            stmt:"P&L",      editable:false},
  {id:"5913",name:"TCR",                       type:"Other Expense",            stmt:"P&L",      editable:false},
];

const ACCOUNT_TYPES = [
  "Current Asset","Fixed Asset","Current Liability","Long-Term Liability",
  "Equity/Capital","Income","Cost of Sale",
  "Sale & Marketing Expense","Administration Expense","Finance Charge","Other Expense"
];

const TYPE_COLOR = {
  "Current Asset":           "#22c55e",
  "Fixed Asset":             "#4ade80",
  "Current Liability":       "#ef4444",
  "Long-Term Liability":     "#f87171",
  "Equity/Capital":          "#a855f7",
  "Income":                  "#3b82f6",
  "Cost of Sale":            "#f59e0b",
  "Sale & Marketing Expense":"#fb923c",
  "Administration Expense":  "#60a5fa",
  "Finance Charge":          "#e879f9",
  "Other Expense":           "#94a3b8",
  "Expense":                 "#94a3b8",
};

const STMT_COLOR = { "Balance Sheet":"#22c55e", "P&L":"#3b82f6" };

// ═══ ICONS ════════════════════════════════════════════════════════════════════
const Ic = {
  plus:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  edit:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>,
  trash:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  x:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  check:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  print:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  info:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  filter: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  book:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
};

// ════════════════════════════════════════════════════════════════
// MODAL — Add / Edit Account (Admin only)
// ════════════════════════════════════════════════════════════════
function AccountModal({ initial, onSave, onClose, existingIds }) {
  const editing = !!initial;
  const [form, setForm] = useState(
    initial
      ? { id: initial.id, name: initial.name, type: initial.type, stmt: initial.stmt }
      : { id: "", name: "", type: "Current Asset", stmt: "Balance Sheet" }
  );
  const [err, setErr] = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto-derive stmt from type
  const handleType = (v) => {
    const bs = ["Current Asset","Fixed Asset","Current Liability","Long-Term Liability","Equity/Capital"];
    set("type", v);
    set("stmt", bs.includes(v) ? "Balance Sheet" : "P&L");
  };

  // Validate ID falls within allowed range
  const validateId = (id) => {
    const num = parseInt(id);
    if (isNaN(num)) return "Account ID must start with a number (e.g. 1010 or 1010-NAME)";
    if (num >= 1000 && num <= 1499 && !["Current Asset","Fixed Asset"].includes(form.type))
      return "IDs 1000-1499 must be Current or Fixed Asset";
    if (num >= 2000 && num <= 2499 && form.type !== "Current Liability")
      return "IDs 2000-2499 must be Current Liability";
    if (num >= 2500 && num <= 2999 && form.type !== "Long-Term Liability")
      return "IDs 2500-2999 must be Long-Term Liability";
    if (num >= 3000 && num <= 3999 && form.type !== "Equity/Capital")
      return "IDs 3000-3999 must be Equity/Capital";
    if (num >= 4000 && num <= 4999 && form.type !== "Income")
      return "IDs 4000-4999 must be Income";
    if (num >= 5000 && num <= 5499 && form.type !== "Cost of Sale")
      return "IDs 5000-5499 must be Cost of Sale";
    if (num >= 5500 && num <= 5999 && !["Sale & Marketing Expense","Administration Expense","Finance Charge","Other Expense","Expense"].includes(form.type))
      return "IDs 5500-5999 must be an Expense type";
    return "";
  };

  const handleSave = () => {
    if (!form.id.trim())   return setErr("Account ID is required");
    if (!form.name.trim()) return setErr("Description is required");
    const rangeErr = validateId(form.id.trim());
    if (rangeErr) return setErr(rangeErr);
    if (!editing && existingIds.includes(form.id.trim()))
      return setErr("Account ID already exists");
    onSave({ ...form, id: form.id.trim(), name: form.name.trim(), editable: true });
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.modalHead}>
          <span style={styles.modalTitle}>{editing ? "Edit Account" : "Add New Account"}</span>
          <button style={styles.iconBtn} onClick={onClose}>{Ic.x}</button>
        </div>
        {err && <div style={styles.errBox}>{err}</div>}

        {/* Range Guide */}
        <div style={styles.rangeGuide}>
          <div style={{...styles.rgi, color:"#94a3b8", fontSize:10, marginBottom:6, fontWeight:700}}>
            ACCOUNT ID RANGES — follow these when adding:
          </div>
          {[
            ["1000–1499","Current Assets"],["1500–1999","Fixed Assets"],
            ["2000–2499","Current Liabilities"],["2500–2999","Long-Term Liabilities"],
            ["3000–3999","Equity/Capital"],["4000–4999","Income"],
            ["5000–5499","Cost of Sales"],["5500–5999","Expenses"],
          ].map(([r,t]) => (
            <div key={r} style={styles.rgi}><span style={{color:"#f59e0b",fontFamily:"monospace"}}>{r}</span><span style={{color:"#a1a1aa"}}> — {t}</span></div>
          ))}
        </div>

        <div style={styles.mf}>
          <label style={styles.mlbl}>Account ID</label>
          <input
            style={{...styles.minput, ...(editing?{opacity:.6}:{})}}
            placeholder="e.g. 1010 or 1010-NAME"
            value={form.id}
            disabled={editing}
            onChange={e => set("id", e.target.value)}
          />
        </div>
        <div style={styles.mf}>
          <label style={styles.mlbl}>Description</label>
          <input
            style={styles.minput}
            placeholder="Account description"
            value={form.name}
            onChange={e => set("name", e.target.value)}
          />
        </div>
        <div style={styles.mf}>
          <label style={styles.mlbl}>Account Type</label>
          <select style={styles.minput} value={form.type} onChange={e => handleType(e.target.value)}>
            {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={styles.mf}>
          <label style={styles.mlbl}>Statement</label>
          <div style={{...styles.minput, background:"#18181b", color: form.stmt==="Balance Sheet"?"#22c55e":"#3b82f6", fontWeight:600}}>
            {form.stmt}
          </div>
        </div>
        <div style={{display:"flex", gap:8, marginTop:4}}>
          <button style={styles.btnSecondary} onClick={onClose}>Cancel</button>
          <button style={styles.btnPrimary} onClick={handleSave}>{Ic.check} {editing?"Update":"Add Account"}</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// WINDOW 1 — Accounts List
// ════════════════════════════════════════════════════════════════
  function AccountsList({ isAdmin }) {
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
  supabase.from("coa_accounts").select("*").order("id")
    .then(({ data }) => {
      if (data && data.length) {
        setAccounts(data);
      } else {
        // First time: seed defaults into Supabase
        const inserts = DEFAULT_ACCOUNTS.map(a => ({
          id: a.id, name: a.name, type: a.type, stmt: a.stmt, editable: a.editable
        }));
        supabase.from("coa_accounts").insert(inserts)
          .then(() => setAccounts(DEFAULT_ACCOUNTS));
      }
    });
}, []);

  const [search, setSearch]     = useState("");
  const [filterType, setFilter] = useState("All");
  const [filterStmt, setStmt]   = useState("All");
  const [modal, setModal]       = useState(null); // null | "add" | account obj

  const save = async (list) => {
  setAccounts(list);
  await saveCOA(list);
  };
  const filtered = useMemo(() => accounts.filter(a => {
    const q = search.toLowerCase();
    const matchQ = !q || a.id.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
    const matchT = filterType === "All" || a.type === filterType;
    const matchS = filterStmt === "All" || a.stmt === filterStmt;
    return matchQ && matchT && matchS;
  }), [accounts, search, filterType, filterStmt]);

  // Group by type for display
  const grouped = useMemo(() => {
    const g = {};
    filtered.forEach(a => {
      if (!g[a.type]) g[a.type] = [];
      g[a.type].push(a);
    });
    return g;
  }, [filtered]);

  const handleSave = async (acc) => {
  if (modal === "add") {
    await save([...accounts, acc]);
  } else {
    await save(accounts.map(a => a.id === acc.id ? acc : a));
  }
  setModal(null);
};

const handleDelete = async (id) => {
  if (!window.confirm(`Delete account ${id}?`)) return;
  await supabase.from("coa_accounts").delete().eq("id", id);
  setAccounts(accounts.filter(a => a.id !== id));
};

  const types = ["All", ...Array.from(new Set(accounts.map(a => a.type)))];

  return (
    <div style={styles.winWrap}>
      {/* Header */}
      <div style={styles.winHead}>
        <div>
          <div style={styles.winTitle}>Accounts List</div>
          <div style={styles.winSub}>{accounts.length} accounts · {filtered.length} shown</div>
        </div>
        <div style={{display:"flex", gap:8, alignItems:"center"}}>
          {isAdmin && (
            <button style={styles.btnPrimary} onClick={() => setModal("add")}>
              {Ic.plus} Add Account
            </button>
          )}
          <button style={styles.btnGhost} onClick={() => window.print()}>{Ic.print} Print</button>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filterRow}>
        <div style={styles.searchWrap}>
          <span style={styles.searchIc}>{Ic.search}</span>
          <input
            style={styles.searchInput}
            placeholder="Search by ID or name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button style={styles.clearBtn} onClick={() => setSearch("")}>{Ic.x}</button>}
        </div>
        <select style={styles.sel} value={filterType} onChange={e => setFilter(e.target.value)}>
          {types.map(t => <option key={t}>{t}</option>)}
        </select>
        <select style={styles.sel} value={filterStmt} onChange={e => setStmt(e.target.value)}>
          <option>All</option><option>Balance Sheet</option><option>P&L</option>
        </select>
      </div>

      {/* Range Reference Card */}
      {isAdmin && (
        <div style={styles.rangeCard}>
          <div style={{display:"flex", alignItems:"center", gap:6, marginBottom:8}}>
            <span style={{width:14, height:14, color:"#f59e0b"}}>{Ic.info}</span>
            <span style={{fontSize:10, fontWeight:700, letterSpacing:".1em", color:"#f59e0b"}}>ACCOUNT RANGE REFERENCE</span>
          </div>
          <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:4}}>
            {ACCOUNT_RANGES.map(r => (
              <div key={r.range} style={styles.rangeItem}>
                <span style={{color:"#f59e0b", fontFamily:"monospace", fontSize:11}}>{r.range}</span>
                <span style={{color:"#a1a1aa", fontSize:10}}>{r.type}</span>
                <span style={{color:"#52525b", fontSize:9}}>{r.stmt}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Account Table */}
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Account ID</th>
              <th style={styles.th}>Description</th>
              <th style={styles.th}>Account Type</th>
              <th style={styles.th}>Statement</th>
              {isAdmin && <th style={{...styles.th, textAlign:"right"}}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([type, accs]) => (
              <>
                <tr key={"grp-"+type}>
                  <td colSpan={isAdmin ? 5 : 4} style={styles.groupRow}>
                    <span style={{...styles.typeBadge, background: (TYPE_COLOR[type]||"#52525b")+"22", color: TYPE_COLOR[type]||"#a1a1aa", border:`1px solid ${(TYPE_COLOR[type]||"#52525b")}44`}}>
                      {type}
                    </span>
                    <span style={{color:"#52525b", fontSize:10, marginLeft:8}}>{accs.length} accounts</span>
                  </td>
                </tr>
                {accs.map(a => (
                  <tr key={a.id} style={styles.tr}>
                    <td style={{...styles.td, fontFamily:"monospace", color:"#f59e0b", fontWeight:600}}>{a.id}</td>
                    <td style={styles.td}>{a.name}</td>
                    <td style={styles.td}>
                      <span style={{...styles.typeBadge, background:(TYPE_COLOR[a.type]||"#52525b")+"18", color:TYPE_COLOR[a.type]||"#a1a1aa"}}>
                        {a.type}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{...styles.stmtBadge, color: STMT_COLOR[a.stmt]||"#a1a1aa"}}>
                        {a.stmt}
                      </span>
                    </td>
                     {isAdmin && (
                    <td style={{...styles.td, textAlign:"right"}}>
                    <div style={{display:"flex", gap:4, justifyContent:"flex-end"}}>
                    <button style={styles.actBtn} onClick={() => setModal(a)} title="Edit">{Ic.edit}</button>
                    <button style={{...styles.actBtn, color:"#ef4444"}} onClick={() => handleDelete(a.id)} title="Delete">{Ic.trash}</button>
                    </div>
                    </td>
                    )}
                  </tr>
                ))}
              </>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={isAdmin?5:4} style={{textAlign:"center", padding:"32px", color:"#52525b"}}>No accounts found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <AccountModal
          initial={modal === "add" ? null : modal}
          existingIds={accounts.map(a => a.id)}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// WINDOW 2 — Reports (Account Breakdown)
// ════════════════════════════════════════════════════════════════
  function AccountReports() {
  const [accounts, setAccounts] = useState([]);
  useEffect(() => {
    supabase.from("coa_accounts").select("*").order("id")
      .then(({ data }) => { if (data && data.length) setAccounts(data); });
  }, []);
  const byStmt = (stmt) => accounts.filter(a => a.stmt === stmt);
  const byType = (type) => accounts.filter(a => a.type === type);

  const bsTypes = [
    "Current Asset","Fixed Asset","Current Liability","Long-Term Liability","Equity/Capital"
  ];
  const plTypes = [
    "Income","Cost of Sale",
    "Sale & Marketing Expense","Administration Expense","Finance Charge","Other Expense"
  ];

  return (
    <div style={styles.winWrap}>
      <div style={styles.winHead}>
        <div>
          <div style={styles.winTitle}>Account Reports</div>
          <div style={styles.winSub}>Account breakdown by category and statement</div>
        </div>
        <button style={styles.btnGhost} onClick={() => window.print()}>{Ic.print} Print</button>
      </div>

      {/* Summary Cards */}
      <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16}}>
        {[
          {label:"Total Accounts",  val: accounts.length,               color:"#f59e0b"},
          {label:"Balance Sheet",   val: byStmt("Balance Sheet").length, color:"#22c55e"},
          {label:"P&L Accounts",    val: byStmt("P&L").length,          color:"#3b82f6"},
          {label:"Expense Accounts",val: accounts.filter(a=>a.type.includes("Expense")).length, color:"#ef4444"},
        ].map(c => (
          <div key={c.label} style={{...styles.statCard, borderColor: c.color+"44"}}>
            <div style={{fontSize:22, fontWeight:700, color:c.color, fontFamily:"monospace"}}>{c.val}</div>
            <div style={{fontSize:11, color:"#71717a", marginTop:2}}>{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:14}}>
        {/* Balance Sheet Section */}
        <div style={styles.reportCard}>
          <div style={styles.reportCardHead}>
            <span style={{color:"#22c55e", fontWeight:700, fontSize:12}}>📊 BALANCE SHEET ACCOUNTS</span>
            <span style={{color:"#52525b", fontSize:11}}>{byStmt("Balance Sheet").length} accounts</span>
          </div>
          {bsTypes.map(type => {
            const accs = byType(type);
            if (!accs.length) return null;
            return (
              <div key={type} style={styles.reportSection}>
                <div style={{...styles.reportSectionHead, color:TYPE_COLOR[type]||"#a1a1aa"}}>
                  {type} ({accs.length})
                </div>
                {accs.map(a => (
                  <div key={a.id} style={styles.reportRow}>
                    <span style={{color:"#f59e0b", fontFamily:"monospace", fontSize:11, minWidth:90}}>{a.id}</span>
                    <span style={{color:"#d4d4d8", fontSize:12}}>{a.name}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* P&L Section */}
        <div style={styles.reportCard}>
          <div style={styles.reportCardHead}>
            <span style={{color:"#3b82f6", fontWeight:700, fontSize:12}}>📈 P&L ACCOUNTS</span>
            <span style={{color:"#52525b", fontSize:11}}>{byStmt("P&L").length} accounts</span>
          </div>
          {plTypes.map(type => {
            const accs = byType(type);
            if (!accs.length) return null;
            return (
              <div key={type} style={styles.reportSection}>
                <div style={{...styles.reportSectionHead, color:TYPE_COLOR[type]||"#a1a1aa"}}>
                  {type} ({accs.length})
                </div>
                {accs.map(a => (
                  <div key={a.id} style={styles.reportRow}>
                    <span style={{color:"#f59e0b", fontFamily:"monospace", fontSize:11, minWidth:90}}>{a.id}</span>
                    <span style={{color:"#d4d4d8", fontSize:12}}>{a.name}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Full Range Reference Table */}
      <div style={{...styles.reportCard, marginTop:14}}>
        <div style={styles.reportCardHead}>
          <span style={{color:"#f59e0b", fontWeight:700, fontSize:12}}>📋 ACCOUNT RANGE REFERENCE</span>
          <span style={{color:"#52525b", fontSize:11}}>Admin reference guide</span>
        </div>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Account Range</th>
              <th style={styles.th}>Account Type</th>
              <th style={styles.th}>Debit Acc</th>
              <th style={styles.th}>Credit Acc</th>
              <th style={styles.th}>Statement</th>
            </tr>
          </thead>
          <tbody>
            {ACCOUNT_RANGES.map(r => (
              <tr key={r.range} style={styles.tr}>
                <td style={{...styles.td, fontFamily:"monospace", color:"#f59e0b"}}>{r.range}</td>
                <td style={styles.td}>{r.type}</td>
                <td style={styles.td}><span style={styles.debitBadge}>{r.debit}</span></td>
                <td style={styles.td}><span style={styles.creditBadge}>{r.credit}</span></td>
                <td style={styles.td}>
                  <span style={{color: STMT_COLOR[r.stmt]||"#a1a1aa", fontSize:11}}>{r.stmt}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN EXPORT — ChartOfAccounts
// ════════════════════════════════════════════════════════════════
export default function ChartOfAccounts({ user }) {
  const isAdmin = user?.designation === "Operational Manager" || user?.role === "admin";
  const [win, setWin] = useState("list"); // "list" | "reports"

  return (
    <div style={{display:"flex", flexDirection:"column", height:"100%", width:"100%"}}>
      {/* Sub-tabs */}
      <div style={styles.subTabs}>
        <button
          style={{...styles.subTab, ...(win==="list" ? styles.subTabAct : {})}}
          onClick={() => setWin("list")}
        >
          {Ic.book} Accounts List
        </button>
        <button
          style={{...styles.subTab, ...(win==="reports" ? styles.subTabAct : {})}}
          onClick={() => setWin("reports")}
        >
          {Ic.filter} Reports
        </button>
      </div>

      {/* Content */}
      <div style={{flex:1, overflowY:"auto", padding:"14px 0"}}>
        {win === "list"    && <AccountsList isAdmin={isAdmin} />}
        {win === "reports" && <AccountReports />}
      </div>
    </div>
  );
}

// ═══ STYLES ═══════════════════════════════════════════════════════════════════
const styles = {
  winWrap:      { padding:"0", width:"100%" },
  winHead:      { display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:14 },
  winTitle:     { fontFamily:"'Playfair Display',serif", fontSize:17, color:"#fafafa" },
  winSub:       { fontSize:10.5, color:"#71717a", marginTop:2 },

  filterRow:    { display:"flex", gap:8, marginBottom:12, flexWrap:"wrap", width:"100%" },
  searchWrap:   { flex:1, minWidth:200, position:"relative", width:"100%" },
  searchIc:     { position:"absolute", left:9, top:"50%", transform:"translateY(-50%)", width:13, height:13, color:"#71717a", pointerEvents:"none" },
  searchInput:  { width:"100%", padding:"8px 10px 8px 28px", background:"#18181b", border:"1px solid #3f3f46", borderRadius:7, fontSize:12.5, color:"#fafafa", outline:"none", fontFamily:"Inter,sans-serif" },
  clearBtn:     { position:"absolute", right:7, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#71717a", width:14, height:14, padding:0 },
  sel:          { padding:"8px 10px", background:"#18181b", border:"1px solid #3f3f46", borderRadius:7, fontSize:12, color:"#fafafa", outline:"none", cursor:"pointer" },

  rangeCard:    { background:"#111113", border:"1px solid #27272a", borderRadius:10, padding:"10px 12px", marginBottom:12 },
  rangeItem:    { display:"flex", flexDirection:"column", gap:1, padding:"4px 0" },
  rgi:          { fontSize:10, lineHeight:1.6 },

  tableWrap:    { background:"#111113", border:"1px solid #27272a", borderRadius:10, overflow:"hidden" },
  table:        { width:"100%", borderCollapse:"collapse" },
  th:           { padding:"9px 12px", background:"#18181b", fontSize:10, fontWeight:700, letterSpacing:".07em", textTransform:"uppercase", color:"#71717a", textAlign:"left", borderBottom:"1px solid #27272a" },
  td:           { padding:"8px 12px", fontSize:12.5, color:"#d4d4d8", borderBottom:"1px solid #1c1c1f", verticalAlign:"middle" },
  tr:           { transition:"background .1s" },
  groupRow:     { padding:"6px 12px", background:"#0d0d0f", borderBottom:"1px solid #1c1c1f" },

  typeBadge:    { display:"inline-block", padding:"2px 7px", borderRadius:20, fontSize:10.5, fontWeight:500 },
  stmtBadge:    { fontSize:11, fontWeight:600 },
  debitBadge:   { display:"inline-block", padding:"2px 7px", borderRadius:4, fontSize:10.5, background:"rgba(34,197,94,.1)", color:"#22c55e" },
  creditBadge:  { display:"inline-block", padding:"2px 7px", borderRadius:4, fontSize:10.5, background:"rgba(239,68,68,.1)", color:"#ef4444" },

  actBtn:       { background:"none", border:"1px solid #27272a", borderRadius:5, cursor:"pointer", color:"#71717a", width:26, height:26, display:"flex", alignItems:"center", justifyContent:"center", padding:0 },

  subTabs:      { display:"flex", gap:4, padding:"0 0 0 0", borderBottom:"1px solid #27272a", marginBottom:4 },
  subTab:       { display:"flex", alignItems:"center", gap:5, padding:"9px 14px", background:"none", border:"none", borderBottom:"2px solid transparent", cursor:"pointer", fontSize:12.5, fontWeight:500, color:"#71717a", fontFamily:"Inter,sans-serif", transition:"all .15s" },
  subTabAct:    { color:"#f59e0b", borderBottomColor:"#f59e0b" },

  statCard:     { background:"#111113", border:"1px solid #27272a", borderRadius:10, padding:"14px 16px" },
  reportCard:   { background:"#111113", border:"1px solid #27272a", borderRadius:10, overflow:"hidden" },
  reportCardHead:{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", background:"#0d0d0f", borderBottom:"1px solid #27272a" },
  reportSection:{ padding:"6px 14px 2px", borderBottom:"1px solid #1c1c1f" },
  reportSectionHead:{ fontSize:10, fontWeight:700, letterSpacing:".07em", textTransform:"uppercase", padding:"5px 0 4px", marginBottom:2 },
  reportRow:    { display:"flex", gap:12, padding:"3px 0", alignItems:"center" },

  overlay:      { position:"fixed", inset:0, background:"rgba(0,0,0,.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:999, padding:20 },
  modal:        { background:"#111113", border:"1px solid #3f3f46", borderRadius:14, padding:"22px 24px", width:"100%", maxWidth:480, maxHeight:"90vh", overflowY:"auto" },
  modalHead:    { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 },
  modalTitle:   { fontFamily:"'Playfair Display',serif", fontSize:16, color:"#fafafa" },
  mf:           { marginBottom:12 },
  mlbl:         { display:"block", fontSize:10, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:"#71717a", marginBottom:4 },
  minput:       { width:"100%", padding:"9px 12px", background:"#18181b", border:"1px solid #3f3f46", borderRadius:7, fontSize:13, color:"#fafafa", outline:"none", fontFamily:"Inter,sans-serif" },
  rangeGuide:   { background:"#0d0d0f", border:"1px solid #27272a", borderRadius:8, padding:"10px 12px", marginBottom:14, fontSize:10 },

  errBox:       { background:"rgba(239,68,68,.08)", border:"1px solid rgba(239,68,68,.3)", color:"#ef4444", borderRadius:7, padding:"8px 12px", fontSize:12, marginBottom:12 },
  btnPrimary:   { display:"flex", alignItems:"center", gap:5, padding:"8px 14px", background:"#f59e0b", color:"#000", border:"none", borderRadius:7, fontSize:12.5, fontWeight:700, cursor:"pointer", fontFamily:"Inter,sans-serif" },
  btnSecondary: { display:"flex", alignItems:"center", gap:5, padding:"8px 14px", background:"#27272a", color:"#fafafa", border:"none", borderRadius:7, fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:"Inter,sans-serif" },
  btnGhost:     { display:"flex", alignItems:"center", gap:5, padding:"8px 14px", background:"none", color:"#a1a1aa", border:"1px solid #3f3f46", borderRadius:7, fontSize:12.5, fontWeight:500, cursor:"pointer", fontFamily:"Inter,sans-serif" },
  iconBtn:      { background:"none", border:"none", cursor:"pointer", color:"#71717a", width:20, height:20, padding:0, display:"flex", alignItems:"center", justifyContent:"center" },
};



