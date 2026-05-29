import { useState } from "react";
import Reports from "../Reports";
import { ls, lss } from "../../utils/helpers";
import { I } from "../../utils/icons";
import { SEED_CLERKS, SEED_INVENTORY, OUTLETS, SUP_COLOR } from "../../data/seeds";
import Toast from "../shared/Toast";
import UserManagement from "./UserManagement";
import OutletManagement from "./OutletManagement";
import AccessControl from "./AccessControl";
import InventoryAdmin from "./InventoryAdmin";
import ChartOfAccounts from "../ChartOfAccounts";
import A_Bank from "./AdminBank";

const fmt = n => Number(n||0).toLocaleString("en-LK",{minimumFractionDigits:2,maximumFractionDigits:2});
const oKey = (outlet, mod) => `${outlet}_${mod}`;
const monthOf = d => (d||"").slice(0,7);
const asArray = (value, fallback = []) => (Array.isArray(value) ? value : fallback);

export default function AdminDashboard({ user, onLogout }) {
  const [page, setPage]   = useState("dash");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [clerks, setCR]   = useState(() => asArray(ls("clerks", SEED_CLERKS), SEED_CLERKS));
  const [outlets, setOR]  = useState(() => asArray(ls("outlets", OUTLETS), OUTLETS));
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");
  const [selOutlet, setSelOutlet] = useState(() => asArray(ls("outlets", OUTLETS), OUTLETS)[0] || OUTLETS[0]);

  const inv = asArray(ls("inv_main", SEED_INVENTORY), SEED_INVENTORY);

  function setClerks(d)  { setCR(d);  lss("clerks", d); }
  function setOutlets(d) { setOR(d);  lss("outlets", d); }
  const t_ = (msg, type="ok") => setToast({ msg, type });

  const mo = new Date().toISOString().slice(0,7);
  const odSales   = asArray(ls(oKey(selOutlet,"sales"), []), []);
  const odExp     = asArray(ls(oKey(selOutlet,"expenses"), []), []);
  const odCash    = asArray(ls(oKey(selOutlet,"cash_ledger"), []), []);

  const navGroups = [
    { label:"Overview", items:[
      { id:"dash",    label:"Dashboard",        icon:I.dash  },
      { id:"odata",   label:"Outlet Data",      icon:I.store },
    ]},
    { label:"Admin", items:[
      { id:"clerks",  label:"Staff",            icon:I.users, cnt:clerks.length  },
      { id:"outlets", label:"Outlets",          icon:I.store, cnt:outlets.length },
      { id:"access",  label:"Access Control",   icon:I.key   },
    ]},
    { label:"Financial", items:[
      { id:"inv",     label:"Inventory",        icon:I.pkg,  cnt:inv.length },
      { id:"coa",     label:"Chart of Accounts",icon:I.coa  },
      { id:"reports", label:"Reports",          icon:I.print },
      { id:"bank", label:"Bank", icon:I.bank }
    ]},
  ];

  const pgTitle = {
    dash:"Dashboard", odata:"Outlet Data Viewer",
    clerks:"Staff Management", outlets:"Outlets",
    access:"Access Control", inv:"Inventory",
    coa:"Chart of Accounts", reports:"Reports", bank:"Bank"
  };

  return (
    <div className="shell shell--drawer">
      <div
        className={`sb-backdrop ${sidebarOpen ? "visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <button type="button" className="sb-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu">{I.x}</button>
        <div className="sbbrand">
          <div className="sblogo">{I.shield}</div>
          <div className="sbtxt"><h2>Accounts Manager</h2><p>Admin Console</p></div>
        </div>
        <nav className="sbnav">
          {navGroups.map(g => (
            <div className="sbgrp" key={g.label}>
              <span className="sbglbl">{g.label}</span>
              {g.items.map(n => (
                <button key={n.id} className={`ni ${page===n.id?"act":""}`}
                  onClick={() => { setPage(n.id); setSearch(""); setSidebarOpen(false); }}>
                  {n.icon}{n.label}
                  {n.cnt !== undefined && <span className="nb">{n.cnt}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="menu-toggle" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle menu">{I.menu}</button>
            <div>
              <h1>{pgTitle[page]}</h1>
              <p>{new Date().toLocaleDateString("en-LK",{day:"numeric",month:"long",year:"numeric"})}</p>
            </div>
          </div>
          <div className="topbar-right">
            <div className="topbar-profile">
              <div className="topbar-user">
                <div className="uav">A</div>
                <div className="uinfo"><p>Administrator</p><span>Full access</span></div>
              </div>
              <button type="button" className="topbar-logout" onClick={onLogout}>Sign out {I.logout}</button>
            </div>
          </div>
        </header>

        <div className="page page-content">

          {/* ── DASHBOARD ── */}
          {page === "dash" && (
            <>
              <div className="sg4">
                <div className="sc"><div className="sl">Total Outlets</div><div className="sv">{outlets.length}</div></div>
                <div className="sc"><div className="sl">Total Staff</div><div className="sv">{clerks.length}</div></div>
                <div className="sc"><div className="sl">Inventory Items</div><div className="sv">{inv.length}</div></div>
                <div className="sc"><div className="sl">Chart of Accounts</div><div className="sv">{asArray(ls("coa_accounts",[]), []).length || 30}</div></div>
              </div>
              <div className="sg2">
                <div className="card">
                  <div className="chd"><h3>Staff Breakdown</h3></div>
                  <div style={{padding:"12px 14px"}}>
                    {Object.entries(clerks.reduce((a,c)=>{a[c.designation]=(a[c.designation]||0)+1;return a;},{})).map(([d,n])=>(
                      <div key={d} style={{marginBottom:10}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,fontSize:11.5}}>
                          <span>{d}</span><span style={{fontWeight:700,color:"var(--gld2)"}}>{n}</span>
                        </div>
                        <div style={{height:4,background:"var(--s3)",borderRadius:2,overflow:"hidden"}}>
                          <div style={{height:"100%",borderRadius:2,background:"linear-gradient(90deg,var(--gld),var(--gld2))",width:`${(n/clerks.length)*100}%`}}/>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card">
                  <div className="chd"><h3>Inventory by Supplier</h3></div>
                  <div style={{padding:"12px 14px",display:"flex",flexWrap:"wrap",gap:7}}>
                    {Object.entries(inv.reduce((a,i)=>{a[i.supplier]=(a[i.supplier]||0)+1;return a;},{})).sort((a,b)=>b[1]-a[1]).map(([sup,count])=>{
                      const col = SUP_COLOR[sup] || "#94a3b8";
                      return (
                        <div key={sup} style={{background:`${col}12`,border:`1px solid ${col}22`,borderRadius:7,padding:"7px 11px"}}>
                          <div style={{fontSize:18,fontFamily:"'Playfair Display',serif",color:col}}>{count}</div>
                          <div style={{fontSize:10,color:col,fontWeight:600}}>{sup.replace(/^\d{4}-/,"")}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="chd"><h3>Recent Staff</h3></div>
                <table className="tbl">
                  <thead><tr><th>Username</th><th>Designation</th><th>Outlet</th><th>Access</th></tr></thead>
                  <tbody>
                    {[...clerks].reverse().slice(0,8).map(c=>(
                      <tr key={c.id}>
                        <td className="bold">{c.username}</td>
                        <td style={{color:"var(--mut)",fontSize:11.5}}>{c.designation}</td>
                        <td style={{color:"var(--mut)",fontSize:11.5}}>{c.outlet}</td>
                        <td style={{fontSize:11,color:"var(--mut)"}}>{c.access}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── OUTLET DATA ── */}
          {page === "odata" && (
            <>
              <div className="ctrls">
                <label style={{fontSize:11,fontWeight:600,color:"var(--mut)"}}>View Outlet:</label>
                <select style={{padding:"6px 10px",background:"var(--s2)",border:"1px solid var(--bdr)",borderRadius:7,fontSize:12.5,fontFamily:"'Inter',sans-serif",color:"var(--txt)",outline:"none",width:200}}
                  value={selOutlet} onChange={e=>setSelOutlet(e.target.value)}>
                  {outlets.map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="sg4">
                <div className="sc"><div className="sl">Month Sales</div><div className="sa cg">Rs.{fmt(odSales.filter(s=>monthOf(s.date)===mo).reduce((a,s)=>a+s.total,0))}</div></div>
                <div className="sc"><div className="sl">Month Expenses</div><div className="sa cr">Rs.{fmt(odExp.filter(e=>monthOf(e.date)===mo).reduce((a,e)=>a+e.amount,0))}</div></div>
                <div className="sc"><div className="sl">Cash Balance</div><div className="sa cg">Rs.{fmt(odCash.reduce((a,t)=>a+(t.type==="in"?t.amount:-t.amount),0))}</div></div>
                <div className="sc"><div className="sl">Total Sales Records</div><div className="sv">{odSales.length}</div></div>
              </div>
              <div className="sg2">
                <div className="card">
                  <div className="chd"><h3>Recent Sales — {selOutlet}</h3></div>
                  <table className="tbl">
                    <thead><tr><th>Date</th><th>By</th><th className="rt">Amount</th></tr></thead>
                    <tbody>
                      {odSales.length===0&&<tr><td colSpan={3}><div className="empty">No sales recorded.</div></td></tr>}
                      {odSales.slice(0,8).map(s=><tr key={s.id}><td className="mono">{s.date}</td><td>{s.by}</td><td className="rt mono cg bold">Rs.{fmt(s.total)}</td></tr>)}
                    </tbody>
                  </table>
                </div>
                <div className="card">
                  <div className="chd"><h3>Recent Expenses — {selOutlet}</h3></div>
                  <table className="tbl">
                    <thead><tr><th>Date</th><th>Category</th><th className="rt">Amount</th></tr></thead>
                    <tbody>
                      {odExp.length===0&&<tr><td colSpan={3}><div className="empty">No expenses.</div></td></tr>}
                      {odExp.slice(0,8).map(e=><tr key={e.id}><td className="mono">{e.date}</td><td style={{fontSize:11}}>{e.accName||e.category}</td><td className="rt mono cr bold">Rs.{fmt(e.amount)}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {page === "clerks"  && <UserManagement clerks={clerks} setClerks={setClerks} outlets={outlets} toast_={t_} />}
          {page === "outlets" && <OutletManagement outlets={outlets} setOutlets={setOutlets} clerks={clerks} toast_={t_} />}
          {page === "access"  && <AccessControl clerks={clerks} setClerks={setClerks} toast_={t_} />}
          {page === "inv"     && <InventoryAdmin toast_={t_} isAdmin={true} />}
          {page === "coa"     && <ChartOfAccounts user={{ ...user, role: "admin" }} />}
          {page === "reports" && <Reports user={user} />}
          {page === "bank" && <A_Bank />}
        </div>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
