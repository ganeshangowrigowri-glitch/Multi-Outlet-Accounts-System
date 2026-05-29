import { useState } from "react";
import Reports from "./components/Reports";
import { ls, lss } from "./utils/helpers";
import { I } from "./utils/icons";
import { SEED_CLERKS, SEED_INVENTORY, SEED_EMPTY, SUPPLIERS_LIST,
         OUTLETS, COA_DEF, uid, today, oKey,
         postCash, postBank, postGL } from "./data/seeds";
import { initOutletSeeds } from "./components/admin/InventoryAdmin";
import AdminDashboard from "./components/admin/AdminDashboard";
import Toast from "./components/shared/Toast";
import Ledger from "./components/shared/Ledger";
import ChartOfAccounts from "./components/ChartOfAccounts";
import S_Dashboard from "./components/staff/S_Dashboard";
import S_AR from "./components/staff/S_AR";
import S_AP from "./components/staff/S_AP";
import S_Inventory from "./components/staff/S_Inventory";
import S_Purchase from "./components/staff/S_Purchase";
import S_Expenses from "./components/staff/S_Expenses";
import S_Bank from "./components/staff/S_Bank";
import "../src/styles/global.css";

const fmt = n => Number(n||0).toLocaleString("en-LK",{minimumFractionDigits:2,maximumFractionDigits:2});

// ═══════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════
function LoginScreen({ onLogin }) {
  const [tab,    setTab]    = useState("admin");
  const [form,   setForm]   = useState({ outlet:"", username:"", password:"" });
  const [showPw, setShowPw] = useState(false);
  const [err,    setErr]    = useState("");

  const getClerkOutlets = () => {
    const u = (form.username||"").trim().toLowerCase();
    const clerks = ls("clerks", SEED_CLERKS);
    const c = clerks.find(x => x.username.toLowerCase() === u);
    if (!c) return [];
    return Array.isArray(c.outlets) ? c.outlets : c.outlet ? [c.outlet] : [];
  };

  function submit() {
    setErr("");
    const u = (form.username||"").trim().toLowerCase();
    const p = (form.password||"").trim();
    if (tab === "admin") {
      if (u==="admin" && p==="admin123") onLogin({ role:"admin", username:"admin" });
      else setErr("Wrong credentials. Use admin / admin123");
    } else {
      if (!form.outlet) { setErr("Select your outlet first."); return; }
      const clerks = ls("clerks", SEED_CLERKS);
      const c = clerks.find(x => {
        const outletList = Array.isArray(x.outlets) ? x.outlets : x.outlet ? [x.outlet] : [];
        return x.username.toLowerCase()===u && x.password===p && outletList.includes(form.outlet);
      });
      if (c) onLogin({ role:"staff", ...c, outlet: form.outlet });
      else setErr("No match. Check outlet, username and password.");
    }
  }

  function handleUsernameChange(val) {
    setForm({ ...form, username: val, outlet: "" });
  }

  const clerkOutlets = tab === "staff" ? getClerkOutlets() : [];

  return (
    <div className="lwrap">
      <div className="lcard">
        <div className="llogo">
          <div className="lmark">{I.shield}</div>
          <h1>Accounts Manager</h1>
          <p>Multi-Outlet Financial System</p>
        </div>
        <div className="ltabs">
          <button className={`ltab ${tab==="admin"?"act":""}`} onClick={()=>{setTab("admin");setErr("");}}>Admin</button>
          <button className={`ltab ${tab==="staff"?"act":""}`} onClick={()=>{setTab("staff");setErr("");}}>Staff / Clerk</button>
        </div>
        {err && <div className="errbox">{err}</div>}

        <div className="lf">
          <label>Username</label>
          <div className="lfw">
            <span className="lfic">{I.user}</span>
            <input value={form.username}
              onChange={e => tab==="staff" ? handleUsernameChange(e.target.value) : setForm({...form,username:e.target.value})}
              placeholder={tab==="admin"?"admin":"username"}
              onKeyDown={e=>e.key==="Enter"&&submit()}/>
          </div>
        </div>

        <div className="lf">
          <label>Password</label>
          <div className="lfw">
            <span className="lfic">{I.lock}</span>
            <input type={showPw?"text":"password"} value={form.password}
              onChange={e=>setForm({...form,password:e.target.value})}
              placeholder="••••••••"
              onKeyDown={e=>e.key==="Enter"&&submit()}/>
            <button className="eyebtn" onClick={()=>setShowPw(!showPw)}>{showPw?I.eyeOff:I.eye}</button>
          </div>
        </div>

        {tab==="staff" && (
          <div className="lf">
            <label>Select Outlet</label>
            <div className="lfw">
              <span className="lfic">{I.bldg}</span>
              <select value={form.outlet} onChange={e=>setForm({...form,outlet:e.target.value})}>
                <option value="">
                  {form.username.trim()
                    ? clerkOutlets.length > 0
                      ? "Select your outlet…"
                      : "Enter username first / no outlets assigned"
                    : "Enter username above first…"}
                </option>
                {clerkOutlets.map(o=><option key={o}>{o}</option>)}
              </select>
            </div>
            {form.username.trim() && clerkOutlets.length === 0 && (
              <div style={{fontSize:10.5,color:"var(--mut2)",marginTop:3}}>
                No outlets found — check username or ask admin.
              </div>
            )}
          </div>
        )}

        <button className="btnlogin" onClick={submit}>Sign In →</button>
        {tab==="admin" && <p style={{fontSize:10.5,color:"var(--mut2)",textAlign:"center",marginTop:9}}>admin / admin123</p>}
      </div>
    </div>
  );
}

function S_GL({outlet}){
  const accounts=ls("coa_accounts",COA_DEF);
  const [selAcc,setSelAcc]=useState("1001");
  const gl=ls(oKey(outlet,"gl"),[]).filter(e=>e.accountId===selAcc);
  const acc=accounts.find(a=>a.id===selAcc);
  let runBal=0;
  return(<>
    <div style={{display:"flex",gap:9,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>
      <label style={{fontSize:11,fontWeight:600,color:"var(--mut)"}}>Account:</label>
      <select style={{padding:"6px 10px",background:"var(--s2)",border:"1px solid var(--bdr)",borderRadius:6,fontSize:12.5,fontFamily:"'Inter',sans-serif",color:"var(--txt)",outline:"none",width:300}} value={selAcc} onChange={e=>setSelAcc(e.target.value)}>
        {accounts.map(a=><option key={a.id} value={a.id}>{a.id} — {a.name}</option>)}
      </select>
      {acc&&<span className={`badge ${acc.stmt==="P&L"?"bb":"ba"}`}>{acc.type}</span>}
      <button className="btn btnd btnsm no-print" onClick={()=>window.print()}>{I.print} Print</button>
    </div>
    <div className="card"><div className="chd"><div><h3>{selAcc} — {acc?.name||"Account"}</h3><p>General Ledger</p></div></div>
      <div style={{padding:12}}>
        <div className="lhd"><div className="lhc">Date</div><div className="lhc">Description</div><div className="lhc rt">Debit</div><div className="lhc rt">Credit</div><div className="lhc rt">Balance</div></div>
        <div className="lrow lbf"><div className="lc mono">{today()}</div><div className="lc">Balance B/F</div><div className="lc"/><div className="lc"/><div className="lc lbal">Rs.0.00</div></div>
        {gl.length===0&&<div className="empty">No entries for this account.</div>}
        {gl.map(e=>{runBal+=(e.debit||0)-(e.credit||0);return <div className="lrow" key={e.id}><div className="lc mono">{e.date}</div><div className="lc">{e.description}</div><div className="lc lin">{e.debit?`Rs.${fmt(e.debit)}`:""}</div><div className="lc lout">{e.credit?`Rs.${fmt(e.credit)}`:""}</div><div className="lc lbal">Rs.{fmt(runBal)}</div></div>;})}
        <div className="lrow lcd"><div className="lc mono">{today()}</div><div className="lc">Balance C/D</div><div className="lc"/><div className="lc"/><div className="lc lbal cg">Rs.{fmt(runBal)}</div></div>
      </div>
    </div>
  </>);
}

function S_Cash({outlet,toast_}){
  const [ledger,setL]=useState(()=>ls(oKey(outlet,"cash_ledger"),[]));
  const [bfBal,setBF]=useState(()=>ls(oKey(outlet,"cash_bf"),0));
  const [manDate,setMD]=useState(today());
  const [manDesc,setMDesc]=useState("");
  const [manType,setMT]=useState("in");
  const [manAmt,setMA]=useState("");
  function setLedger(d){setL(d);lss(oKey(outlet,"cash_ledger"),d);}
  function saveBF(){lss(oKey(outlet,"cash_bf"),parseFloat(bfBal)||0);toast_("B/F updated ✓");}
  function saveManual(){
    if(!manAmt||parseFloat(manAmt)<=0){toast_("Enter valid amount","err");return;}
    const entry={id:uid(),date:manDate,description:manDesc||"Manual Entry",type:manType,amount:parseFloat(manAmt)};
    setLedger([...ledger,entry]);
    postGL(outlet,{date:manDate,accountId:"1001",description:manDesc||"Manual Entry",debit:manType==="in"?parseFloat(manAmt):0,credit:manType==="out"?parseFloat(manAmt):0});
    toast_("Entry saved ✓");setMDesc("");setMA("");
  }
  const bfVal=parseFloat(ls(oKey(outlet,"cash_bf"),0))||0;
  const balance=bfVal+ledger.reduce((a,t)=>a+(t.type==="in"?t.amount:-t.amount),0);
  return(<>
    <div className="sg3"><div className="sc"><div className="sl">Account</div><div className="sv">1001</div></div><div className="sc"><div className="sl">Entries</div><div className="sv">{ledger.length}</div></div><div className="sc"><div className="sl">Cash Balance</div><div className="sa" style={{color:balance>=0?"var(--grn)":"var(--red)"}}>Rs.{fmt(balance)}</div></div></div>
    <div className="sg2">
      <div className="card"><div className="chd"><h3>Opening Balance (B/F)</h3></div><div style={{padding:14,display:"flex",gap:8,alignItems:"flex-end"}}><div className="ff" style={{marginBottom:0,flex:1}}><label>Balance B/F (Rs.)</label><input type="number" value={bfBal} onChange={e=>setBF(e.target.value)}/></div><button className="btn btnd btnsm" onClick={saveBF}>{I.check} Set</button></div></div>
      <div className="card"><div className="chd"><h3>Manual Entry</h3></div><div style={{padding:14}}><div className="fg"><div className="ff"><label>Date</label><input type="date" value={manDate} onChange={e=>setMD(e.target.value)}/></div><div className="ff"><label>Type</label><select value={manType} onChange={e=>setMT(e.target.value)}><option value="in">Cash In</option><option value="out">Cash Out</option></select></div><div className="ff"><label>Amount</label><input type="number" value={manAmt} onChange={e=>setMA(e.target.value)}/></div><div className="ff"><label>Description</label><input placeholder="e.g. Bank Deposit" value={manDesc} onChange={e=>setMDesc(e.target.value)}/></div></div><button className="btn btng" onClick={saveManual}>{I.check} Add Entry</button></div></div>
    </div>
    <div className="card"><div className="chd"><div><h3>In Hand Cash Ledger (1001)</h3><p>Auto-linked from Sales, Expenses, Returns</p></div><button className="btn btnd btnsm no-print" onClick={()=>window.print()}>{I.print} Print</button></div><div style={{padding:12}}><Ledger rows={ledger} bfBal={bfVal}/></div></div>
  </>);
}

// ═══════════════════════════════════════════
// STAFF PORTAL
// ═══════════════════════════════════════════
function StaffPortal({ user, onLogout }) {
  const outlet = user.outlet;
  const [page,        setPage]        = useState("dash");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast,       setToast]       = useState(null);
  // ── inv sub-tab state lifted here so topbar can show tabs ──
  const [invSubTab,   setInvSubTab]   = useState("daily");
  const [invDailyTab, setInvDailyTab] = useState("main");

  const toast_ = (msg, type="ok") => setToast({ msg, type });

  const nav = [
    { id:"dash",    label:"Dashboard",           icon:I.dash  },
    { id:"ar",      label:"Accounts Receivable",  icon:I.ar   },
    { id:"ap",      label:"Accounts Payable",     icon:I.ap   },
    { id:"gl",      label:"General Ledger",       icon:I.gl   },
    { id:"inv",     label:"Stock / Inventory",    icon:I.pkg  },
    { id:"pur",     label:"Purchase",             icon:I.pur  },
    { id:"exp",     label:"Expenses",             icon:I.exp  },
    { id:"cash",    label:"In Hand Cash",         icon:I.cash },
    { id:"bank",    label:"Bank",                 icon:I.bank },
    { id:"reports", label:"Reports",              icon:I.print},
    { id:"coa",     label:"Chart of Accounts",    icon:I.coa  },
  ];

  const pgTitle = {
    dash:"Dashboard", ar:"Accounts Receivable", ap:"Accounts Payable",
    gl:"General Ledger", inv:"Stock / Inventory", pur:"Purchase",
    exp:"Expenses", cash:"In Hand Cash", bank:"Bank",
    reports:"Reports", coa:"Chart of Accounts"
  };

  return (
    <div className="shell shell--drawer" style={{
      display: "flex", height: "100vh", overflow: "hidden", position: "relative",
    }}>
      {/* Backdrop */}
      <div
        className={`sb-backdrop ${sidebarOpen ? "visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* ── SIDEBAR ── */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`} style={{
        display: "flex", flexDirection: "column", height: "100%", overflow: "hidden",
      }}>
        {/* Brand + close */}
        <div style={{ flexShrink: 0 }}>
          <button type="button" className="sb-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu">{I.x}</button>
          <div className="sbbrand">
            <div className="sblogo">{I.shield}</div>
            <div className="sbtxt"><h2>Accounts</h2><p>{outlet}</p></div>
          </div>
        </div>

        {/* Scrollable nav */}
        <nav className="sbnav" style={{
          flex: 1, minHeight: 0,
          overflowY: "auto", overflowX: "hidden",
          scrollbarWidth: "thin",
          scrollbarColor: "var(--s3,#2a2a45) transparent",
        }}>
          <div className="sbgrp">
            <span className="sbglbl">Modules</span>
            {nav.map(n => (
              <button key={n.id} className={`ni ${page===n.id?"act":""}`}
                onClick={() => { setPage(n.id); setSidebarOpen(false); }}>
                {n.icon}{n.label}
              </button>
            ))}
          </div>
        </nav>

        {/* ── Compact Sign Out at sidebar bottom ── */}
        <div style={{
          flexShrink: 0,
          borderTop: "1px solid var(--s3, #2a2a45)",
          padding: "8px 10px",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {/* Avatar + name */}
          <div className="uav staff" style={{ width: 28, height: 28, fontSize: 10, borderRadius: 7, flexShrink: 0 }}>
            {user.username.slice(0,2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--txt)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.username}</div>
            <div style={{ fontSize: 9.5, color: "var(--mut)" }}>{outlet}</div>
          </div>
          {/* Sign out icon button */}
          <button
            type="button"
            onClick={onLogout}
            title="Sign Out"
            style={{
              flexShrink: 0, width: 30, height: 30,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--s3, #1e1e38)",
              border: "1px solid var(--bdr, #2e2e50)",
              borderRadius: 7, cursor: "pointer",
              color: "var(--mut)", fontSize: 15,
              transition: "background .15s, color .15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--red-dim, #3a1a1a)"; e.currentTarget.style.color = "var(--red, #f87171)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--s3, #1e1e38)"; e.currentTarget.style.color = "var(--mut)"; }}
          >
            {I.logout || "⎋"}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="main" style={{
        display: "flex", flexDirection: "column",
        flex: 1, minWidth: 0,
        height: "100vh", overflow: "hidden",
      }}>

        {/* ── TOPBAR — compact, no Print/user/signout ── */}
        <header className="topbar" style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          padding: "0 12px 0 4px",
          minHeight: 44,
          height: 44,
          borderBottom: "1px solid var(--s3, #2a2a45)",
          background: "var(--s1, #0d0d1a)",
          flexShrink: 0,
        }}>
          {/* Hamburger */}
          <button
            type="button"
            className="menu-toggle"
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="Toggle menu"
            style={{ flexShrink: 0, marginRight: 6 }}
          >
            {I.menu}
          </button>

          {/* Page title — short */}
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: "var(--txt)", whiteSpace: "nowrap",
            marginRight: 16, flexShrink: 0,
          }}>
            {pgTitle[page]}
          </span>

          {/* ── Inventory sub-tabs inline in topbar ── */}
          {page === "inv" && (
            <div style={{ display: "flex", alignItems: "stretch", height: "100%", gap: 0 }}>
              {/* Daily Sale / Current Status */}
              {[["daily","Daily Sale"],["status","Current Status"]].map(([id,lbl]) => (
                <button key={id}
                  onClick={() => setInvSubTab(id)}
                  style={{
                    height: "100%", padding: "0 14px",
                    fontSize: 12, fontWeight: 600,
                    background: "transparent",
                    color: invSubTab === id ? "var(--gld, #f59e0b)" : "var(--mut)",
                    border: "none",
                    borderBottom: invSubTab === id
                      ? "2px solid var(--gld, #f59e0b)"
                      : "2px solid transparent",
                    cursor: "pointer", whiteSpace: "nowrap",
                    transition: "color .15s, border-color .15s",
                  }}
                >{lbl}</button>
              ))}

              {/* Main / Empty sub-tabs — only when Daily Sale active */}
              {invSubTab === "daily" && (
                <>
                  <div style={{ width: 1, background: "var(--s3)", margin: "8px 8px" }} />
                  {[["main","📦 Main"],["empty","🧴 Empty"]].map(([id,lbl]) => (
                    <button key={id}
                      onClick={() => setInvDailyTab(id)}
                      style={{
                        height: "100%", padding: "0 12px",
                        fontSize: 11.5, fontWeight: 600,
                        background: invDailyTab === id ? "var(--s2, #1a1a30)" : "transparent",
                        color: invDailyTab === id ? "var(--acc, #f59e0b)" : "var(--mut2)",
                        border: "none",
                        borderBottom: invDailyTab === id
                          ? "2px solid var(--acc, #f59e0b)"
                          : "2px solid transparent",
                        cursor: "pointer", whiteSpace: "nowrap",
                        borderRadius: "0",
                        transition: "all .15s",
                      }}
                    >{lbl}</button>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Outlet + date pill — pushed right */}
          <div style={{
            marginLeft: "auto", flexShrink: 0,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{
              fontSize: 10.5, color: "var(--mut)",
              background: "var(--s2)", padding: "3px 9px",
              borderRadius: 20, border: "1px solid var(--s3)",
              whiteSpace: "nowrap",
            }}>
              {outlet} · {new Date().toLocaleDateString("en-LK",{day:"numeric",month:"short"})}
            </span>
          </div>
        </header>

        {/* ── PAGE CONTENT — full remaining height ── */}
        <div className="page page-content" style={{
          overflowY: page === "inv" ? "hidden" : "auto",
          overflowX: "hidden",
          padding: page === "inv" ? "8px 12px 0" : "16px 20px 24px",
          boxSizing: "border-box",
          ...(page === "inv" ? { display:"flex", flexDirection:"column", flex:1, minHeight:0 } : {}),
        }}>
          {page==="dash" && <S_Dashboard outlet={outlet} user={user}/>}
          {page==="ar"   && <S_AR outlet={outlet}/>}
          {page==="ap"   && <S_AP outlet={outlet} user={user} toast_={toast_}/>}
          {page==="gl"   && <S_GL outlet={outlet}/>}
          {page==="inv"  && (
            <S_Inventory
              outlet={outlet}
              user={user}
              toast_={toast_}
              subTab={invSubTab}
              setSubTab={setInvSubTab}
              dailyTab={invDailyTab}
              setDailyTab={setInvDailyTab}
            />
          )}
          {page==="pur"  && <S_Purchase outlet={outlet} user={user} toast_={toast_}/>}
          {page==="exp"  && <S_Expenses outlet={outlet} user={user} toast_={toast_}/>}
          {page==="cash" && <S_Cash outlet={outlet} toast_={toast_}/>}
          {page==="bank" && <S_Bank outlet={outlet} toast_={toast_}/>}
          {page==="coa"  && <ChartOfAccounts user={user}/>}
          {page==="reports" && <Reports user={user}/>}
        </div>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
    </div>
  );
}

// ═══════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════
export default function App() {
  initOutletSeeds();
  const [session, setSession] = useState(() => ls("session", null));
  function login(u)  { setSession(u); lss("session", u); }
  function logout()  { setSession(null); lss("session", null); }
  return (
    <>
      {!session                && <LoginScreen onLogin={login}/>}
      {session?.role==="admin" && <AdminDashboard user={session} onLogout={logout}/>}
      {session?.role==="staff" && <StaffPortal    user={session} onLogout={logout}/>}
    </>
  );
}
