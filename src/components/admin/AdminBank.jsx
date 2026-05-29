// src/components/admin/A_Bank.jsx
// ─────────────────────────────────────────────────────────────
//  Admin › Bank Management
//  Tabs: Bank Master | All Entries | Access Control
// ─────────────────────────────────────────────────────────────
import { useState } from "react";
import { ls, lss } from "../../utils/helpers";
import { I } from "../../utils/icons";
import Modal from "../shared/Modal";

const BANK_KEY   = "admin_bank_accounts";   // master list of bank accounts
const ENTRY_KEY  = "admin_bank_all_entries"; // read-only view (entries come from outlet keys)

const BANKS = [
  "Commercial Bank","Sampath Bank","HNB","BOC","NSB",
  "Peoples Bank","NTB/AMEX","DFCC","Seylan Bank","Union Bank",
];

const OUTLETS_KEY = "outlets"; // same key used by your OutletManagement

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
export default function A_Bank() {
  const [tab, setTab] = useState(0);

  return (
    <div>
      {/* ── Tab Bar ── */}
      <div className="stabs no-print" style={{ marginBottom: 16 }}>
        {["Bank Master","All Entries","Access Control"].map((t, i) => (
          <button key={i} className={`stab ${tab === i ? "act" : ""}`} onClick={() => setTab(i)}>
            {[I.bank, I.gl, I.shield][i]} {t}
          </button>
        ))}
      </div>

      {tab === 0 && <BankMaster />}
      {tab === 1 && <AllEntries />}
      {tab === 2 && <BankAccess />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB 0 — Bank Master
// ════════════════════════════════════════════════════════════
function BankMaster() {
  const [accounts, setAccounts] = useState(() => ls(BANK_KEY, SEED_BANKS));
  const [search,   setSearch]   = useState("");
  const [filterB,  setFilterB]  = useState("");
  const [modal,    setModal]    = useState(null); // null | "add" | "edit"
  const [form,     setForm]     = useState({});

  const outlets = ls(OUTLETS_KEY, []).map(o => typeof o === "string" ? o : o.name || o.outlet || "");

  function save(list) { setAccounts(list); lss(BANK_KEY, list); }

  function openAdd() {
    setForm({ outlet:"", bank:"", accountNo:"", accountName:"", branch:"", active:true, hidden:false });
    setModal("add");
  }
  function openEdit(a) { setForm({ ...a }); setModal("edit"); }

  function submitForm() {
    if (!form.outlet || !form.bank || !form.accountNo || !form.accountName) return;
    if (modal === "add") {
      save([...accounts, { ...form, id: uid() }]);
    } else {
      save(accounts.map(a => a.id === form.id ? { ...form } : a));
    }
    setModal(null);
  }

  function toggleActive(id) {
    save(accounts.map(a => a.id === id ? { ...a, active: !a.active } : a));
  }
  function toggleHidden(id) {
    save(accounts.map(a => a.id === id ? { ...a, hidden: !a.hidden } : a));
  }
  function del(id) {
    if (window.confirm("Delete this bank account?")) save(accounts.filter(a => a.id !== id));
  }

  const visible = accounts.filter(a => {
    const q = search.toLowerCase();
    const matchQ = !q || a.outlet.toLowerCase().includes(q) || a.bank.toLowerCase().includes(q) || a.accountNo.includes(q) || a.accountName.toLowerCase().includes(q);
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
                <tr><td colSpan={9}><div className="empty">No bank accounts found.</div></td></tr>
              )}
              {visible.map((a, i) => (
                <tr key={a.id} style={{ opacity: a.hidden ? 0.5 : 1 }}>
                  <td className="mono" style={{ color:"var(--mut)", fontSize:11 }}>{i+1}</td>
                  <td>
                    <div style={{ fontWeight:600, fontSize:13 }}>{a.outlet}</div>
                  </td>
                  <td>
                    <span className="badge bb">{a.bank}</span>
                  </td>
                  <td className="mono" style={{ letterSpacing:".04em" }}>{a.accountNo}</td>
                  <td style={{ fontSize:12.5 }}>{a.accountName}</td>
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

            {/* Bank */}
            <div className="ff">
              <label>Bank *</label>
              <select value={form.bank} onChange={e => setForm({...form, bank: e.target.value})}>
                <option value="">Select bank…</option>
                {BANKS.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>

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
// TAB 1 — All Entries (cross-outlet audit view)
// ════════════════════════════════════════════════════════════
function AllEntries() {
  const bankAccounts = ls(BANK_KEY, SEED_BANKS);
  const outlets      = [...new Set(bankAccounts.map(a => a.outlet))];

  // Gather all entries from all outlet bank ledgers
  const allEntries = outlets.flatMap(outlet => {
    const ledger = ls(`outlet_${outlet}_bank_ledger`, []);
    return ledger.map(e => ({ ...e, outlet }));
  }).sort((a, b) => b.date.localeCompare(a.date));

  const [filterO, setFilterO] = useState("");
  const [filterT, setFilterT] = useState("");
  const [fromD,   setFromD]   = useState("");
  const [toD,     setToD]     = useState("");

  const rows = allEntries.filter(e => {
    if (filterO && e.outlet !== filterO) return false;
    if (filterT && e.type  !== filterT)  return false;
    if (fromD   && e.date  < fromD)      return false;
    if (toD     && e.date  > toD)        return false;
    return true;
  });

  const totalIn  = rows.filter(e => e.type === "in").reduce((a, e)  => a + e.amount, 0);
  const totalOut = rows.filter(e => e.type === "out").reduce((a, e) => a + e.amount, 0);

  return (
    <>
      {/* ── Summary ── */}
      <div className="sg3" style={{ marginBottom: 14 }}>
        <div className="sc"><div className="sl">Total Entries</div><div className="sa">{rows.length}</div></div>
        <div className="sc"><div className="sl">Total In</div><div className="sa cg">Rs.{fmt(totalIn)}</div></div>
        <div className="sc"><div className="sl">Total Out</div><div className="sa cr">Rs.{fmt(totalOut)}</div></div>
      </div>

      {/* ── Filters ── */}
      <div className="chd" style={{ marginBottom: 12, flexWrap:"wrap", gap:8 }}>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <select className="btn btnsm" value={filterO} onChange={e => setFilterO(e.target.value)}>
            <option value="">All outlets</option>
            {outlets.map(o => <option key={o}>{o}</option>)}
          </select>
          <select className="btn btnsm" value={filterT} onChange={e => setFilterT(e.target.value)}>
            <option value="">All types</option>
            <option value="in">Bank In</option>
            <option value="out">Bank Out</option>
          </select>
          <input type="date" className="btn btnsm" value={fromD} onChange={e => setFromD(e.target.value)} />
          <input type="date" className="btn btnsm" value={toD}   onChange={e => setToD(e.target.value)} />
        </div>
        <button className="btn btnd btnsm no-print" onClick={() => window.print()}>{I.print} Print</button>
      </div>

      {/* ── Table ── */}
      <div className="card" style={{ padding:0, overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Outlet</th>
                <th>Bank / Account</th>
                <th>Cheque No.</th>
                <th>Description</th>
                <th>Type</th>
                <th className="rt">Amount</th>
                <th>Staff</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={8}><div className="empty">No entries found.</div></td></tr>
              )}
              {rows.map(e => (
                <tr key={e.id}>
                  <td className="mono">{e.date}</td>
                  <td style={{ fontSize:12.5 }}>{e.outlet}</td>
                  <td>
                    <div style={{ fontSize:12.5 }}>{e.bankName || "—"}</div>
                    <div className="mono" style={{ fontSize:10.5, color:"var(--mut)" }}>{e.accountNo || ""}</div>
                  </td>
                  <td className="mono" style={{ fontSize:12 }}>{e.chequeNo || "—"}</td>
                  <td style={{ fontSize:12.5 }}>{e.description}</td>
                  <td>
                    <span className={`badge ${e.type === "in" ? "ba" : "bd"}`}>
                      {e.type === "in" ? "Bank In" : "Bank Out"}
                    </span>
                  </td>
                  <td className={`rt mono bold ${e.type === "in" ? "cg" : "cr"}`}>
                    Rs.{fmt(e.amount)}
                  </td>
                  <td style={{ fontSize:12, color:"var(--mut)" }}>{e.by || "—"}</td>
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
// TAB 2 — Access Control (which outlets can use bank module)
// ════════════════════════════════════════════════════════════
function BankAccess() {
  const AKEY = "bank_access_control";
  const bankAccounts = ls(BANK_KEY, SEED_BANKS);
  const outlets      = [...new Set(bankAccounts.map(a => a.outlet))];
  const [access, setAccess] = useState(() => ls(AKEY, {}));

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
              const accs    = bankAccounts.filter(a => a.outlet === outlet && !a.hidden);
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
                            <span className="mono" style={{ fontSize:11 }}>{a.accountNo}</span>
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
