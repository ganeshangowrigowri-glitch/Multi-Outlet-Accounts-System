// src/components/admin/A_Bank.jsx
// ─────────────────────────────────────────────────────────────
//  Admin › Bank Management
//  Tabs: Bank Master | All Entries | Access Control
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { ls, lss } from "../../utils/helpers";
import { supabase } from "../../supabase";
import { I } from "../../utils/icons";
import Modal from "../shared/Modal";

const BANK_KEY   = "admin_bank_accounts";   // master list of bank accounts
const ENTRY_KEY  = "admin_bank_all_entries"; // read-only view (entries come from outlet keys)

const BANKS = [
  "Commercial Bank","Sampath Bank","HNB","BOC","NSB",
  "Peoples Bank","NTB/AMEX","DFCC","Seylan Bank","Union Bank",
];

const normAccount = (a) => ({
  ...a,
  outlet_id:    a.outlet_id    || a.outlet    || "",
  account_no:   a.account_no   || a.accountNo || "",
  account_name: a.account_name || a.accountName || "",
  bank:         a.bank || "",
  branch:       a.branch || "",
  active:       a.active !== false,
  hidden:       a.hidden || false,
  account_type: a.account_type || "bank",
  fee_pct:      Number(a.fee_pct) || 0,
});

// ── seed bank accounts so something shows on first load ──
const SEED_BANKS = [
  { id:"ba1", outlet:"The Royal Bar",    bank:"Commercial Bank", accountNo:"1000234567", accountName:"Royal Bar (Pvt) Ltd", branch:"Colombo 03", active:true,  hidden:false },
  { id:"ba2", outlet:"Sky Lounge",       bank:"Sampath Bank",    accountNo:"0052819900", accountName:"Sky Lounge Ltd",       branch:"Kandy",      active:true,  hidden:false },
  { id:"ba3", outlet:"Harbor Spirits",   bank:"HNB",             accountNo:"0084422100", accountName:"Harbor Spirits",       branch:"Galle",      active:false, hidden:false },
  { id:"ba4", outlet:"Sunset Tavern",    bank:"BOC",             accountNo:"7712300088", accountName:"Sunset Tavern (Pvt)", branch:"Negombo",    active:true,  hidden:false },
];

const uid = () => "ba" + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const fmt  = n  => Number(n||0).toLocaleString("en-LK",{minimumFractionDigits:2,maximumFractionDigits:2});

// ════════════════════════════════════════════════════════════
export default function A_Bank({ outlets: outletsProp = [], toast_ }) {
  const [tab, setTab] = useState(0);

  return (
    <div>
      {/* ── Tab Bar ── */}
      <div className="stabs no-print" style={{ marginBottom: 16 }}>
        {["Bank Master","Access Control"].map((t, i) => (
       <button key={i} className={`stab ${tab === i ? "act" : ""}`} onClick={() => setTab(i)}>
       {[I.bank, I.shield][i]} {t}
       </button>
       ))}
        
      </div>

      {tab === 0 && <BankMaster outlets={outletsProp} toast_={toast_} />}
      {tab === 1 && <BankAccess />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB 0 — Bank Master
// ════════════════════════════════════════════════════════════
  function BankMaster({ outlets: outletsProp = [], toast_ }) {
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    supabase.from("bank_accounts").select("*")
      .then(({ data }) => {
        if (data && data.length) setAccounts(data.map(normAccount));
        else setAccounts(ls(BANK_KEY, SEED_BANKS).map(normAccount));
      });
  }, []);
  const [search,   setSearch]   = useState("");
  const [filterB,  setFilterB]  = useState("");
  const [modal,    setModal]    = useState(null); // null | "add" | "edit"
  const [form,     setForm]     = useState({});

  const outlets = outletsProp.length
    ? outletsProp
    : ls("outlets", []).map(o => typeof o === "string" ? o : o.name || o.outlet || "");

   async function save(list) { const n = list.map(normAccount); setAccounts(n); lss(BANK_KEY, n); }

  function openAdd() {
    setForm({ outlet:"", bank:"", accountNo:"", accountName:"", branch:"", active:true, hidden:false, accountType:"bank", feePct:"" });
    setModal("add");
  }
  function openEdit(a) {
    setForm({
      id: a.id,
      outlet: a.outlet_id || a.outlet || "",
      bank: a.bank || "",
      accountNo: a.account_no || a.accountNo || "",
      accountName: a.account_name || a.accountName || "",
      branch: a.branch || "",
      active: a.active !== false,
      hidden: a.hidden || false,
      accountType: a.account_type || "bank",
      feePct: a.fee_pct ?? "",
    });
    setModal("edit");
  }

async function submitForm() {
  if (!form.outlet || !form.bank || !form.accountNo || !form.accountName) {
    toast_?.("Fill all required fields", "err");
    return;
  }

  const row = {
    outlet_id:    form.outlet,
    bank:         form.bank,
    account_no:   form.accountNo,
    account_name: form.accountName,
    branch:       form.branch || "",
    active:       form.active,
    hidden:       form.hidden || false,
    account_type: form.accountType || "bank",
    fee_pct:      Number(form.feePct) || 0,
  };

  if (modal === "add") {
    const newId = crypto.randomUUID();
    const { data, error } = await supabase.from("bank_accounts")
      .insert({ ...row, id: newId })
      .select()
      .single();
    if (error) {
      console.error("bank_accounts insert:", error);
      toast_?.("Failed to save account: " + error.message, "err");
      return;
    }
    setAccounts(prev => [...prev, normAccount(data)]);
    toast_?.("Account added ✓");
  } else {
    const { error } = await supabase.from("bank_accounts").update(row).eq("id", form.id);
    if (error) {
      console.error("bank_accounts update:", error);
      toast_?.("Failed to update account: " + error.message, "err");
      return;
    }
    setAccounts(prev => prev.map(a => a.id === form.id ? normAccount({ ...a, ...row }) : a));
    toast_?.("Account updated ✓");
  }
  setModal(null);
}
  async function toggleActive(id) {
  const acc = accounts.find(a => a.id === id);
  const { error } = await supabase.from("bank_accounts").update({ active: !acc.active }).eq("id", id);
  if (error) console.error("toggleActive:", error);
  setAccounts(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
}
async function toggleHidden(id) {
  const acc = accounts.find(a => a.id === id);
  const nextHidden = !acc.hidden;
  const { error } = await supabase.from("bank_accounts").update({ hidden: nextHidden }).eq("id", id);
  if (error) console.error("toggleHidden:", error);
  setAccounts(prev => prev.map(a => a.id === id ? { ...a, hidden: nextHidden } : a));
}
async function del(id) {
  if (!window.confirm("Delete this bank account?")) return;
  const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
  if (error) console.error("delete bank account:", error);
  setAccounts(prev => prev.filter(a => a.id !== id));
}

  const visible = accounts.filter(a => {
    const q = search.toLowerCase();
    const outletName = (a.outlet_id || a.outlet || "").toLowerCase();
    const acctNo = a.account_no || a.accountNo || "";
    const acctName = (a.account_name || a.accountName || "").toLowerCase();
    const matchQ = !q || outletName.includes(q) || (a.bank || "").toLowerCase().includes(q) || acctNo.includes(q) || acctName.includes(q);
    const matchB = !filterB || a.bank === filterB;
    return matchQ && matchB;
  });

  // metrics
  const total    = accounts.length;
  const active   = accounts.filter(a => a.active).length;
  const inactive = accounts.filter(a => !a.active).length;
  const hidden   = accounts.filter(a => a.hidden).length;

  return (
    <>
      {/* ── Metrics ── */}
      <div className="sg4" style={{ marginBottom: 14 }}>
        {[["Total Accounts", total, "ca"],["Active", active, "cg"],["Inactive", inactive, "cr"],["Hidden", hidden, ""]].map(([l,v,c]) => (
          <div className="sc" key={l}><div className="sl">{l}</div><div className={`sa ${c}`}>{v}</div></div>
        ))}
      </div>

     {/* ── Toolbar ── */}
<div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, flexWrap:"wrap" }}>
  <input
    placeholder="🔍 Search outlet, bank, account…"
    value={search}
    onChange={e => setSearch(e.target.value)}
    className="btn btnsm"
    style={{ width:200 }}
  />
  <select className="btn btnsm" value={filterB} onChange={e => setFilterB(e.target.value)}>
    <option value="">All banks</option>
    {BANKS.map(b => <option key={b}>{b}</option>)}
  </select>
  <button className="btn btng btnsm" onClick={openAdd}>{I.plus} Add Account</button>
  <button className="btn btnd btnsm no-print" onClick={() => window.print()}>{I.print} Print</button>
</div>
      {/* ── Table ── */}
      <div className="card" style={{ padding: 0, overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>Outlet / Bar Name</th>
                <th>Type</th>
                <th>Bank</th>
                <th>Account Number</th>
                <th>Account Name</th>
                <th>Branch</th>
                <th>Status</th>
                <th>Visible</th>
                <th style={{ textAlign:"center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr><td colSpan={10}><div className="empty">No bank accounts found.</div></td></tr>
              )}
              {visible.map((a, i) => (
                <tr key={a.id} style={{ opacity: a.hidden ? 0.5 : 1 }}>
                  <td className="mono" style={{ color:"var(--mut)", fontSize:11 }}>{i+1}</td>
                  <td>
                    <div style={{ fontWeight:600, fontSize:13 }}>{a.outlet_id}</div>
                  </td>
                  <td>
                    <span className={`badge ${a.account_type === "card" ? "bg" : "bb"}`}>
                      {a.account_type === "card" ? `Card (${a.fee_pct}% fee)` : "Bank"}
                    </span>
                  </td>
                  <td>
                    <span className="badge bb">{a.bank}</span>
                  </td>
                  <td className="mono" style={{ letterSpacing:".04em" }}>{a.account_no}</td>
                  <td style={{ fontSize:12.5 }}>{a.account_name}</td>
                  <td style={{ fontSize:12, color:"var(--mut)" }}>{a.branch}</td>
                  <td>
                    <span className={`badge ${a.active ? "ba" : "bd"}`}>
                      {a.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${a.hidden ? "bd" : "bc"}`}>
                      {a.hidden ? "Hidden" : "Visible"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display:"flex", gap:4, justifyContent:"center", flexWrap:"wrap" }}>
                      <button className="btn btnsm" title="Edit" onClick={() => openEdit(a)}>{I.edit}</button>
                      <button className="btn btnsm" title={a.active ? "Deactivate" : "Activate"} onClick={() => toggleActive(a.id)}>
                        {a.active ? I.eyeOff : I.check}
                      </button>
                      <button className="btn btnsm" title={a.hidden ? "Show" : "Hide"} onClick={() => toggleHidden(a.id)}>
                        {a.hidden ? I.eye : I.eye}
                      </button>
                      <button className="btn btnsm" title="Delete" style={{ color:"var(--red)" }} onClick={() => del(a.id)}>{I.trash}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add / Edit Modal ── */}
      {modal && (
        <Modal
          title={modal === "add" ? "Add Bank Account" : "Edit Bank Account"}
          onClose={() => setModal(null)}
          footer={
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button className="btn btnsm" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btng btnsm" onClick={submitForm}>{I.check} {modal === "add" ? "Add" : "Save"}</button>
            </div>
          }
        >
          <div className="fg">
            {/* Outlet */}
            <div className="ff">
              <label>Outlet / Bar Name *</label>
              {outlets.length > 0
                ? <select value={form.outlet} onChange={e => setForm({...form, outlet: e.target.value})}>
                    <option value="">Select outlet…</option>
                    {outlets.map(o => <option key={o}>{o}</option>)}
                  </select>
                : <input placeholder="e.g. The Royal Bar" value={form.outlet} onChange={e => setForm({...form, outlet: e.target.value})} />
              }
            </div>

            {/* Account Type */}
            <div className="ff">
              <label>Account Type *</label>
              <select value={form.accountType || "bank"} onChange={e => setForm({...form, accountType: e.target.value})}>
                <option value="bank">Bank Account</option>
                <option value="card">Card / POS Settlement Account</option>
              </select>
            </div>

            {/* Bank */}
            <div className="ff">
              <label>Bank *</label>
              <select value={form.bank} onChange={e => setForm({...form, bank: e.target.value})}>
                <option value="">Select bank…</option>
                {BANKS.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>

            {/* Merchant fee — only relevant for card accounts */}
            {(form.accountType === "card") && (
              <div className="ff">
                <label>Merchant Discount Fee (%)</label>
                <input type="number" step="0.01" placeholder="e.g. 2.5" value={form.feePct ?? ""} onChange={e => setForm({...form, feePct: e.target.value})} />
              </div>
            )}

            {/* Account Number */}
            <div className="ff">
              <label>Account Number *</label>
              <input placeholder="e.g. 1000234567" value={form.accountNo} onChange={e => setForm({...form, accountNo: e.target.value})} />
            </div>

            {/* Account Name */}
            <div className="ff">
              <label>Account Name *</label>
              <input placeholder="e.g. Royal Bar (Pvt) Ltd" value={form.accountName} onChange={e => setForm({...form, accountName: e.target.value})} />
            </div>

            {/* Branch */}
            <div className="ff">
              <label>Branch</label>
              <input placeholder="e.g. Colombo 03" value={form.branch} onChange={e => setForm({...form, branch: e.target.value})} />
            </div>

            {/* Status toggles */}
            <div className="ff">
              <label>Status</label>
              <select value={form.active ? "active" : "inactive"} onChange={e => setForm({...form, active: e.target.value === "active"})}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="ff">
              <label>Visibility</label>
              <select value={form.hidden ? "hidden" : "visible"} onChange={e => setForm({...form, hidden: e.target.value === "hidden"})}>
                <option value="visible">Visible to Staff</option>
                <option value="hidden">Hidden from Staff</option>
              </select>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
// ════════════════════════════════════════════════════════════
// TAB 1 — Access Control (which outlets can use bank module)
// ════════════════════════════════════════════════════════════
 function BankAccess() {
  const AKEY = "bank_access_control";
  const [bankAccounts, setBankAccounts] = useState([]);
  const [access, setAccess] = useState(() => ls(AKEY, {}));

  useEffect(() => {
    supabase.from("bank_accounts").select("*")
      .then(({ data }) => { if (data) setBankAccounts(data); });
  }, []);

  const outlets = [...new Set(bankAccounts.map(a => a.outlet_id).filter(Boolean))];

  function toggle(outlet) {
    const updated = { ...access, [outlet]: !access[outlet] };
    setAccess(updated);
    lss(AKEY, updated);
  }

  return (
    <>
      <div style={{ marginBottom: 12, fontSize:12.5, color:"var(--mut)" }}>
        Control which outlets have access to the Bank module. Staff can only see their assigned outlet&apos;s accounts.
      </div>
      <div className="card" style={{ padding:0, overflow:"hidden" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Outlet / Bar Name</th>
              <th>Bank Accounts Assigned</th>
              <th style={{ textAlign:"center" }}>Bank Module Access</th>
            </tr>
          </thead>
          <tbody>
            {outlets.length === 0 && (
              <tr><td colSpan={3}><div className="empty">No outlets with bank accounts yet.</div></td></tr>
            )}
            {outlets.map(outlet => {
              const accs    = bankAccounts.filter(a => a.outlet_id === outlet && !a.hidden);
              const enabled = access[outlet] !== false; // default ON
              return (
                <tr key={outlet}>
                  <td style={{ fontWeight:600 }}>{outlet}</td>
                  <td>
                    {accs.length === 0
                      ? <span style={{ color:"var(--mut)", fontSize:12 }}>No accounts assigned</span>
                      : accs.map(a => (
                          <div key={a.id} style={{ fontSize:12, marginBottom:2 }}>
                            <span className="badge bb" style={{ marginRight:4 }}>{a.bank}</span>
                            <span className="mono" style={{ fontSize:11 }}>{a.account_no}</span>
                          </div>
                        ))
                    }
                  </td>
                  <td style={{ textAlign:"center" }}>
                    <button
                      className={`btn btnsm ${enabled ? "btng" : ""}`}
                      onClick={() => toggle(outlet)}
                      style={{ minWidth:90 }}
                    >
                      {enabled ? <>{I.check} Enabled</> : <>{I.x} Disabled</>}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
