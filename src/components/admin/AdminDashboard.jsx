import { useState, useEffect, useMemo } from "react";
import Reports from "../Reports";
import { I } from "../../utils/icons";
import { OUTLETS, SUP_COLOR } from "../../data/seeds";
import Toast from "../shared/Toast";
import UserManagement from "./UserManagement";
import OutletManagement from "./OutletManagement";
import AccessControl from "./AccessControl";
import InventoryAdmin from "./InventoryAdmin";
import ChartOfAccounts from "../ChartOfAccounts";
import A_Bank from "./AdminBank";
import AreaSalesPurchaseReport from "./AreaSalesPurchaseReport";
import PhysicalStockAreaReport from "./PhysicalStockAreaReport";

import {
  getClerks, saveClerks, addClerk, updateClerk, deleteClerk,
  ensureOutlets, addOutlet, deleteOutlet, sortOutletsByOrder,
  getInventoryMaster,
  getSales, getExpenses, getCashLedger, getCOA
} from "../../db";

const fmt = n => Number(n||0).toLocaleString("en-LK",{minimumFractionDigits:2,maximumFractionDigits:2});
const monthOf = d => (d||"").slice(0,7);
const asArray = (v, fb=[]) => Array.isArray(v) ? v : fb;

const ACC = { gold:"#f5b400", red:"#f43f5e", blue:"#3b82f6", purple:"#8b5cf6", teal:"#10d9a0" };
// Solid fills, one per accent color (no gradient, no transparency)
const SOLID = {
  "#ceda2d": "#a57b09",   
  "#f43f5e": "#242323",  
  "#3b82f6": "#070707",   
  "#a843e2": "#2a1550",   
  "#10d9a0": "#084134",   
};

const tint = c => ({
  background: SOLID[c] || "#14141a",
  border:`1px solid ${c}40`,
  borderRadius:14,
});
const monoNum = c => ({
  fontFamily:"'JetBrains Mono', ui-monospace, Menlo, monospace",
  fontSize:26, fontWeight:700, letterSpacing:".5px", color:c, marginTop:6,
});

export default function AdminDashboard({ user, onLogout }) {
  const [page,       setPage]      = useState("dash");
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [clerks,     setCR]        = useState([]);
  const [outlets,    setOR]        = useState([]);
  const [inv,        setInv]       = useState([]);
  const [allCOA, setAllCOA] = useState([]);
  
  const [toast,      setToast]     = useState(null);
  const [search,     setSearch]    = useState("");
  const [selOutlet,  setSelOutlet] = useState("");

  // outlet data viewer
  const [odSales,  setOdSales]  = useState([]);
  const [odExp,    setOdExp]    = useState([]);
  const [odCash,   setOdCash]   = useState([]);
  const [loading,  setLoading]  = useState(true);

  const t_ = (msg, type="ok") => setToast({ msg, type });
  const mo = new Date().toISOString().slice(0,7);

 // ── initial load ──
// ── initial load ──
useEffect(() => {
  Promise.all([
    getClerks(),
    getInventoryMaster(),
    getCOA(),
    ensureOutlets(OUTLETS),
  ]).then(([c, i, coa, outletList]) => {
    setCR(c);
    const list = outletList.length ? outletList : OUTLETS;
    setOR(list);
    setSelOutlet(list[0] || "");
    setInv(i);
    setAllCOA(coa);
  }).catch(err => {
    console.error("Initial load failed:", err);
    // Fall back to seed data so the UI still renders
    setOR(OUTLETS);
    setSelOutlet(OUTLETS[0] || "");
  }).finally(() => {
    setLoading(false);  // ← always runs, even on error
  });
}, []);

  // ── load outlet data when selOutlet changes ──
  useEffect(() => {
    if (!selOutlet) return;
    getSales(selOutlet).then(setOdSales);
    getExpenses(selOutlet).then(setOdExp);
    getCashLedger(selOutlet).then(setOdCash);
  }, [selOutlet]);

  // ── clerk CRUD passed down to UserManagement ──
  async function setClerks(newClerks) {
    setCR(newClerks);
    await saveClerks(newClerks);
  }
  async function handleAddClerk(clerk) {
    const saved = await addClerk(clerk);
    if (saved) setCR(prev => [...prev, { ...saved, outlets: saved.outlet_ids||[], outlet: saved.outlet_ids?.[0]||"", password: clerk.password }]);
    t_(`"${clerk.username}" added ✓`);
  }
  async function handleUpdateClerk(id, clerk) {
    await updateClerk(id, clerk);
    setCR(prev => prev.map(c => c.id===id ? { ...c, ...clerk, password_hash: clerk.password } : c));
    t_("Updated ✓");
  }
  async function handleDeleteClerk(id, username) {
    if (!confirm(`Remove "${username}"?`)) return;
    await deleteClerk(id);
    setCR(prev => prev.filter(c => c.id!==id));
    t_("Removed");
  }

  // ── outlet management ──
  async function handleAddOutlet(name) {
    const result = await addOutlet(name);
    if (result.ok) {
      setOR(prev => sortOutletsByOrder(prev.includes(name) ? prev : [...prev, name], OUTLETS));
    }
    return result;
  }
  async function handleDeleteOutlet(name) {
    const result = await deleteOutlet(name);
    if (result.ok) setOR(prev => prev.filter(x => x !== name));
    return result;
  }

  const navGroups = [
    { label:"Overview", items:[
      { id:"dash",    label:"Dashboard",         icon:I.dash  },
      { id:"odata",   label:"Outlet Data",       icon:I.store },
    ]},
    { label:"Admin", items:[
      { id:"clerks",  label:"Staff",             icon:I.users, cnt:clerks.length  },
      { id:"outlets", label:"Outlets",           icon:I.store, cnt:outlets.length },
      { id:"access",  label:"Access Control",    icon:I.key   },
    ]},
    { label:"Financial", items:[
      { id:"inv",     label:"Inventory",         icon:I.pkg,  cnt:inv.length },
      { id:"coa",     label:"Chart of Accounts", icon:I.coa  },
          { id:"reports", label:"Reports",           icon:I.print },
         { id:"areaReport", label:"Area Sales & Purchase", icon:I.chart },
         { id:"physicalStockArea", label:"Physical Stock – Area", icon:I.pkg },
      { id:"bank",    label:"Bank",              icon:I.bank  },
    ]},
  ];

  const pgTitle = {
    dash:"Dashboard", odata:"Outlet Data Viewer",
    clerks:"Staff Management", outlets:"Outlets",
    access:"Access Control", inv:"Inventory",
       coa:"Chart of Accounts", reports:"Reports", areaReport:"Area Sales & Purchase",
    physicalStockArea:"Physical Stock – Area Wise",
    bank:"Bank"
  };
  // ── dashboard sales analytics (read-only, reuses getSales) ──
const [salesByOutlet, setSBO] = useState(null);   // null = not loaded yet
const [hoverBar, setHoverBar] = useState(null);

useEffect(() => {
  if (page !== "dash" || !outlets.length || salesByOutlet !== null) return;
  let alive = true;
  Promise.all(
    [...new Set(outlets)].map(o =>
      getSales(o).then(r => [o, asArray(r)]).catch(() => [o, []])
    )
  ).then(rows => { if (alive) setSBO(Object.fromEntries(rows)); });
  return () => { alive = false; };
}, [page, outlets, salesByOutlet]);

const salesStats = useMemo(() => {
  if (!salesByOutlet) return null;
  const daily = {};
  const rows = Object.entries(salesByOutlet).map(([name, list]) => {
    const seen = new Set();
    let total = 0;
    list.forEach(s => {
      if (monthOf(s.date) !== mo) return;
      if (s.id != null) { if (seen.has(s.id)) return; seen.add(s.id); } // no double count
      const amt = Number(s.total || 0);
      total += amt;
      daily[s.date] = (daily[s.date] || 0) + amt;
    });
    return { name, total };
  });
  const ranked = rows.filter(r => r.total > 0).sort((a, b) => b.total - a.total);
  const total = ranked.reduce((a, r) => a + r.total, 0);
  const days = new Date().getDate();
  const trend = Array.from({ length: days }, (_, i) => {
    const key = `${mo}-${String(i + 1).padStart(2, "0")}`;
    return { day: i + 1, amt: daily[key] || 0 };
  });
  return {
    top: ranked.slice(0, 10),
    total,
    count: ranked.length,
    avg: ranked.length ? total / ranked.length : 0,
    best: ranked[0] || null,
    trend,
  };
}, [salesByOutlet, mo]);
  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:"var(--mut)",fontSize:14}}>
      Loading…
    </div>
  );

  return (
    <div className="shell shell--drawer">
      <div className={`sb-backdrop ${sidebarOpen?"visible":""}`} onClick={()=>setSidebarOpen(false)} aria-hidden="true"/>
      <aside className={`sidebar ${sidebarOpen?"open":""}`}>
        <button type="button" className="sb-close" onClick={()=>setSidebarOpen(false)} aria-label="Close menu">{I.x}</button>
        <div className="sbbrand">
          <div className="sblogo">{I.shield}</div>
          <div className="sbtxt"><h2>Accounts Manager</h2><p>Admin Console</p></div>
        </div>
        <nav className="sbnav">
          {navGroups.map(g=>(
            <div className="sbgrp" key={g.label}>
              <span className="sbglbl">{g.label}</span>
              {g.items.map(n=>(
                <button key={n.id} className={`ni ${page===n.id?"act":""}`}
                  onClick={()=>{setPage(n.id);setSearch("");setSidebarOpen(false);}}>
                  {n.icon}{n.label}
                  {n.cnt!==undefined&&<span className="nb">{n.cnt}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="menu-toggle" onClick={()=>setSidebarOpen(o=>!o)} aria-label="Toggle menu">{I.menu}</button>
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
          {page==="dash" && (
  <>
    <div style={{...tint(ACC.gold), padding:"22px 26px", marginBottom:16,
                 display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:14}}>
      <div>
        <div style={{fontSize:11,letterSpacing:2,fontWeight:700,color:"var(--mut)",textTransform:"uppercase"}}>
          {new Date().getHours()<12?"Good morning":new Date().getHours()<17?"Good afternoon":"Good evening"}
        </div>
        <div style={{fontSize:30,fontWeight:800,fontFamily:"'Playfair Display', serif",margin:"4px 0"}}>Administrator</div>
        <div style={{fontSize:12.5,color:"var(--mut)"}}>
          System Admin • {new Date().toLocaleDateString("en-LK",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
        </div>
      </div>
      <div style={{textAlign:"right"}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"10px 18px",borderRadius:10,
                     background:`${ACC.gold}14`,border:`1px solid ${ACC.gold}55`,color:ACC.gold,fontWeight:700,letterSpacing:1.5,fontSize:13}}>
          <span style={{width:8,height:8,borderRadius:"50%",background:ACC.teal}}/> ALL OUTLETS · {outlets.length}
        </div>
        <div style={{fontSize:11.5,color:"var(--mut)",marginTop:10}}>Access: Full access</div>
      </div>
    </div>

    <div className="sg4">
               <div className="sc" style={tint(ACC.gold)}><div className="sl">Total Outlets</div><div style={monoNum(ACC.gold)}>{outlets.length}</div></div>
<div className="sc" style={tint(ACC.blue)}><div className="sl">Total Staff</div><div style={monoNum(ACC.blue)}>{clerks.length}</div></div>
<div className="sc" style={tint(ACC.purple)}><div className="sl">Inventory Items</div><div style={monoNum(ACC.purple)}>{inv.length}</div></div>
<div className="sc" style={tint(ACC.teal)}><div className="sl">Chart of Accounts</div><div style={monoNum(ACC.teal)}>{allCOA.length}</div></div>
              </div>
              {/* ── SALES ANALYTICS ── */}
<div className="sg4">
 <div className="sc" style={tint(ACC.gold)}><div className="sl">Total Sales (This Month)</div>
  <div style={monoNum(ACC.gold)}>{salesStats ? `Rs.${fmt(salesStats.total)}` : "…"}</div></div>
<div className="sc" style={tint(ACC.teal)}><div className="sl">Highest-Selling Outlet</div>
  <div style={{...monoNum(ACC.teal),fontSize:18}}>{salesStats?.best?.name || "—"}</div>
  {salesStats?.best && <div style={{fontSize:11,color:"var(--mut)",marginTop:2}}>Rs.{fmt(salesStats.best.total)}</div>}</div>
<div className="sc" style={tint(ACC.blue)}><div className="sl">Outlets With Sales</div>
  <div style={monoNum(ACC.blue)}>{salesStats ? `${salesStats.count} / ${outlets.length}` : "…"}</div></div>
<div className="sc" style={tint(ACC.purple)}><div className="sl">Average Sales / Outlet</div>
  <div style={monoNum(ACC.purple)}>{salesStats ? `Rs.${fmt(salesStats.avg)}` : "…"}</div></div>
</div>

<div className="sg2">
  <div className="card" style={tint(ACC.gold)}>
  <div className="chd"><h3>Top 10 Sales Outlets</h3></div>
    <div style={{padding:"12px 14px"}}>
      {!salesStats && <div className="empty">Loading sales…</div>}
      {salesStats && salesStats.top.length === 0 && <div className="empty">No sales recorded for this month.</div>}
      {salesStats?.top.map((r, i) => {
        const pct = (r.total / salesStats.top[0].total) * 100;
        const accent = ["#f7bb16", "#cbd5e1", "#d08a4e"][i] || "rgba(245,180,0,.35)";
        return (
          <div key={r.name} style={{marginBottom:10, position:"relative"}}
               onMouseEnter={()=>setHoverBar(r.name)} onMouseLeave={()=>setHoverBar(null)}
               title={`#${i+1} ${r.name} — Rs.${fmt(r.total)}`}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,fontSize:11.5}}>
              <span><span style={{color:"var(--mut)",marginRight:6}}>{i+1}.</span>{r.name}</span>
              <span style={{fontWeight:700,color:i<3?accent:"var(--txt)"}}>Rs.{fmt(r.total)}</span>
            </div>
            <div style={{height:6,background:"var(--s3)",borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:3,width:`${pct}%`,background:accent,
              opacity:hoverBar && hoverBar!==r.name ? .45 : 1, transition:"width .3s, opacity .15s"}}/>
            </div>
          </div>
        );
      })}
    </div>
  </div>

  <div className="card" style={tint(ACC.blue)}>
    <div className="chd"><h3>Daily Sales Trend — {new Date().toLocaleDateString("en-LK",{month:"long",year:"numeric"})}</h3></div>
    <div style={{padding:"12px 14px"}}>
      {!salesStats && <div className="empty">Loading sales…</div>}
      {salesStats && salesStats.total === 0 && <div className="empty">No sales recorded for this month.</div>}
      {salesStats && salesStats.total > 0 && (() => {
        const max = Math.max(...salesStats.trend.map(d => d.amt), 1);
        return (
          <>
            <div style={{display:"flex",alignItems:"flex-end",gap:3,height:170}}>
              {salesStats.trend.map(d => (
                <div key={d.day} title={`Day ${d.day}: Rs.${fmt(d.amt)}`}
                     style={{flex:1,minWidth:2,height:`${Math.max((d.amt/max)*100, d.amt>0?2:0)}%`,
                             background:"linear-gradient(180deg,var(--gld2),var(--gld))",borderRadius:"2px 2px 0 0"}}/>
              ))}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--mut)",marginTop:6}}>
              <span>1</span><span>Day of month</span><span>{salesStats.trend.length}</span>
            </div>
          </>
        );
      })()}
    </div>
  </div>
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
                      const col=SUP_COLOR[sup]||"#94a3b8";
                      return (
                        <div key={sup} style={{background:`${col}12`,border:`1px solid ${col}22`,borderRadius:7,padding:"7px 11px"}}>
                          <div style={{fontSize:18,color:col}}>{count}</div>
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
                        <td style={{color:"var(--mut)",fontSize:11.5}}>{asArray(c.outlets,[c.outlet]).join(", ")}</td>
                        <td style={{fontSize:11,color:"var(--mut)"}}>{c.access}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── OUTLET DATA ── */}
          {page==="odata" && (
            <>
              <div className="ctrls">
                <label style={{fontSize:11,fontWeight:600,color:"var(--mut)"}}>View Outlet:</label>
                <select style={{padding:"6px 10px",background:"var(--s2)",border:"1px solid var(--bdr)",borderRadius:7,fontSize:12.5,color:"var(--txt)",outline:"none",width:200}}
                  value={selOutlet} onChange={e=>setSelOutlet(e.target.value)}>
                  {outlets.map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="sg4">
                <div className="sc"><div className="sl">Month Sales</div><div className="sa cg">Rs.{fmt(odSales.filter(s=>monthOf(s.date)===mo).reduce((a,s)=>a+(s.total||0),0))}</div></div>
                <div className="sc"><div className="sl">Month Expenses</div><div className="sa cr">Rs.{fmt(odExp.filter(e=>monthOf(e.date)===mo).reduce((a,e)=>a+(e.amount||0),0))}</div></div>
                <div className="sc"><div className="sl">Cash Balance</div><div className="sa cg">Rs.{fmt(odCash.reduce((a,t)=>a+(t.debit||0)-(t.credit||0),0))}</div></div>
                <div className="sc"><div className="sl">Total Sales Records</div><div className="sv">{odSales.length}</div></div>
              </div>
              <div className="sg2">
                <div className="card">
                  <div className="chd"><h3>Recent Sales — {selOutlet}</h3></div>
                  <table className="tbl">
                    <thead><tr><th>Date</th><th>Payment</th><th className="rt">Amount</th></tr></thead>
                    <tbody>
                      {odSales.length===0&&<tr><td colSpan={3}><div className="empty">No sales recorded.</div></td></tr>}
                      {odSales.slice(0,8).map(s=><tr key={s.id}><td className="mono">{s.date}</td><td>{s.payment_method}</td><td className="rt mono cg bold">Rs.{fmt(s.total)}</td></tr>)}
                    </tbody>
                  </table>
                </div>
                <div className="card">
                  <div className="chd"><h3>Recent Expenses — {selOutlet}</h3></div>
                  <table className="tbl">
                    <thead><tr><th>Date</th><th>Description</th><th className="rt">Amount</th></tr></thead>
                    <tbody>
                      {odExp.length===0&&<tr><td colSpan={3}><div className="empty">No expenses.</div></td></tr>}
                      {odExp.slice(0,8).map(e=><tr key={e.id}><td className="mono">{e.date}</td><td style={{fontSize:11}}>{e.description}</td><td className="rt mono cr bold">Rs.{fmt(e.amount)}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {page==="clerks"  && (
            <UserManagement
              clerks={clerks}
              setClerks={setClerks}
              onAdd={handleAddClerk}
              onUpdate={handleUpdateClerk}
              onDelete={handleDeleteClerk}
              outlets={outlets}
              toast_={t_}
            />
          )}
          {page==="outlets" && <OutletManagement outlets={outlets} onAddOutlet={handleAddOutlet} onDeleteOutlet={handleDeleteOutlet} clerks={clerks} toast_={t_}/>}
          {page==="access"  && <AccessControl clerks={clerks} setClerks={setClerks} toast_={t_}/>}
          {page==="inv"     && <InventoryAdmin toast_={t_} isAdmin={true} adminOutlets={outlets}/>}
          {page==="coa"     && <ChartOfAccounts user={{...user,role:"admin"}}/>}
          {page==="reports" && <Reports user={user}/>}
          {page==="areaReport" && <AreaSalesPurchaseReport outlets={outlets} toast_={t_}/>}
          {page==="physicalStockArea" && <PhysicalStockAreaReport outlets={outlets} toast_={t_}/>}
          {page==="bank"    && <A_Bank outlets={outlets} toast_={t_}/>}
        </div>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
    </div>
  );
}